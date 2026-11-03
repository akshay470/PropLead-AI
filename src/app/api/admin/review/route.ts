import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { conversations, leads, projects, handoffs, users, messages } from "@/server/db/schema";
import { eq, desc, and, isNull, isNotNull, gte, inArray } from "drizzle-orm";

/**
 * GET /api/admin/review
 * Returns flagged conversation review queue and daily digest metrics.
 * Strictly protected: Admin role required (Sales Head).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Login required." },
        { status: 401 }
      );
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Sales Head admin privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "pending"; // 'pending' | 'reviewed' | 'all'

    // Calculate start of today in UTC
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Daily Digest Counts
    const allFlagged = await db
      .select({
        id: conversations.id,
        createdAt: conversations.createdAt,
        reviewedAt: conversations.reviewedAt,
      })
      .from(conversations)
      .where(eq(conversations.flagged, true));

    const flaggedToday = allFlagged.filter(
      (c) => new Date(c.createdAt) >= startOfToday
    ).length;

    const reviewedToday = allFlagged.filter(
      (c) => c.reviewedAt && new Date(c.reviewedAt) >= startOfToday
    ).length;

    const pendingReview = allFlagged.filter((c) => !c.reviewedAt).length;

    // 2. Fetch Flagged Conversations based on filter
    const conditions = [eq(conversations.flagged, true)];
    if (filter === "pending") {
      conditions.push(isNull(conversations.reviewedAt));
    } else if (filter === "reviewed") {
      conditions.push(isNotNull(conversations.reviewedAt));
    }

    const flaggedConvs = await db
      .select({
        id: conversations.id,
        leadId: conversations.leadId,
        projectId: conversations.projectId,
        flagReason: conversations.flagReason,
        reviewedAt: conversations.reviewedAt,
        reviewNotes: conversations.reviewNotes,
        createdAt: conversations.createdAt,
        leadName: leads.name,
        leadCode: leads.leadCode,
        leadPhone: leads.phoneE164,
        leadWants: leads.wants,
        projectName: projects.name,
      })
      .from(conversations)
      .innerJoin(leads, eq(conversations.leadId, leads.id))
      .leftJoin(projects, eq(conversations.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(conversations.createdAt));

    // 3. Attach Latest Handoff and Messages for each flagged conversation
    const convIds = flaggedConvs.map((c) => c.id);
    let allMessages: Array<{
      conversationId: string;
      id: string;
      role: string;
      content: string;
      flagged: boolean;
      flagReason: string | null;
      createdAt: Date;
    }> = [];

    let allHandoffs: Array<{
      conversationId: string | null;
      leadId: string;
      id: string;
      reason: string;
      summary: string;
      notes: string | null;
      executiveId: string;
      executiveName: string;
    }> = [];

    if (convIds.length > 0) {
      allMessages = await db
        .select({
          conversationId: messages.conversationId,
          id: messages.id,
          role: messages.role,
          content: messages.content,
          flagged: messages.flagged,
          flagReason: messages.flagReason,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.conversationId, convIds))
        .orderBy(messages.createdAt);

      const leadIds = flaggedConvs.map((c) => c.leadId);
      allHandoffs = await db
        .select({
          conversationId: handoffs.conversationId,
          leadId: handoffs.leadId,
          id: handoffs.id,
          reason: handoffs.reason,
          summary: handoffs.summary,
          notes: handoffs.notes,
          executiveId: handoffs.executiveId,
          executiveName: users.name,
        })
        .from(handoffs)
        .innerJoin(users, eq(handoffs.executiveId, users.id))
        .where(inArray(handoffs.leadId, leadIds))
        .orderBy(desc(handoffs.createdAt));
    }

    const messagesByConv = new Map<string, typeof allMessages>();
    for (const m of allMessages) {
      if (!messagesByConv.has(m.conversationId)) {
        messagesByConv.set(m.conversationId, []);
      }
      messagesByConv.get(m.conversationId)!.push(m);
    }

    const handoffByLead = new Map<string, (typeof allHandoffs)[0]>();
    for (const h of allHandoffs) {
      if (!handoffByLead.has(h.leadId)) {
        handoffByLead.set(h.leadId, h);
      }
    }

    const formatted = flaggedConvs.map((c) => {
      const msgs = messagesByConv.get(c.id) || [];
      const offendingMessage = msgs.find((m) => m.flagged) || null;
      const lastUserQuestion = [...msgs].reverse().find((m) => m.role === "user")?.content || "";

      return {
        id: c.id,
        leadId: c.leadId,
        projectId: c.projectId,
        flagReason: c.flagReason || "compliance_review",
        reviewedAt: c.reviewedAt,
        reviewNotes: c.reviewNotes,
        createdAt: c.createdAt,
        lead: {
          id: c.leadId,
          name: c.leadName,
          leadCode: c.leadCode,
          phone: c.leadPhone,
          wants: c.leadWants,
        },
        project: {
          id: c.projectId,
          name: c.projectName || "Company A Project",
        },
        handoff: handoffByLead.get(c.leadId) || null,
        offendingMessage,
        lastUserQuestion,
        messages: msgs,
      };
    });

    return NextResponse.json({
      success: true,
      digest: {
        flaggedToday,
        reviewedToday,
        pendingReview,
      },
      conversations: formatted,
    });
  } catch (error) {
    console.error("GET /api/admin/review error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
