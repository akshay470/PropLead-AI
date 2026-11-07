import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import {
  leads,
  projects,
  users,
  handoffs,
  bookings,
  visitSlots,
  reminders,
  conversations,
  messages,
  leadScores,
} from "@/server/db/schema";
import { eq, desc, asc } from "drizzle-orm";

/**
 * GET /api/leads/[id]
 * Returns full lead details, project info, assigned executive,
 * latest handoff summary, active visit booking, and full chronological chat transcript.
 * Enforces RBAC: Executives see only their own and unassigned leads; Admin sees all.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "executive" && user.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Executive or Admin access required." },
        { status: 401 }
      );
    }

    const leadId = params.id;

    // 1. Fetch Lead
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    // Role check: Executives see their own or unassigned leads only
    if (
      user.role === "executive" &&
      lead.assignedExecutiveId &&
      lead.assignedExecutiveId !== user.userId
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not authorized to view this lead" },
        { status: 403 }
      );
    }

    // 2. Fetch Project
    let project = null;
    if (lead.projectId) {
      const [p] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, lead.projectId))
        .limit(1);
      project = p || null;
    }

    // 3. Fetch Assigned Executive
    let assignedExecutive = null;
    if (lead.assignedExecutiveId) {
      const [u] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, lead.assignedExecutiveId))
        .limit(1);
      assignedExecutive = u || null;
    }

    // 4. Fetch Latest Handoff
    const [latestHandoff] = await db
      .select({
        id: handoffs.id,
        reason: handoffs.reason,
        status: handoffs.status,
        summary: handoffs.summary,
        notes: handoffs.notes,
        createdAt: handoffs.createdAt,
        resolvedAt: handoffs.resolvedAt,
      })
      .from(handoffs)
      .where(eq(handoffs.leadId, leadId))
      .orderBy(desc(handoffs.createdAt))
      .limit(1);

    // 5. Fetch Active Booking & Slot
    const [activeBooking] = await db
      .select({
        id: bookings.id,
        slotId: bookings.slotId,
        status: bookings.status,
        createdAt: bookings.createdAt,
        startsAt: visitSlots.startsAt,
        endsAt: visitSlots.endsAt,
      })
      .from(bookings)
      .innerJoin(visitSlots, eq(bookings.slotId, visitSlots.id))
      .where(eq(bookings.leadId, leadId))
      .orderBy(desc(bookings.createdAt))
      .limit(1);

    // Fetch reminder schedule for active booking
    let bookingReminders: Array<{
      id: string;
      type: string;
      scheduledAt: Date;
      sentAt: Date | null;
      status: string;
      createdAt: Date;
    }> = [];

    if (activeBooking) {
      bookingReminders = await db
        .select({
          id: reminders.id,
          type: reminders.type,
          scheduledAt: reminders.scheduledAt,
          sentAt: reminders.sentAt,
          status: reminders.status,
          createdAt: reminders.createdAt,
        })
        .from(reminders)
        .where(eq(reminders.bookingId, activeBooking.id))
        .orderBy(asc(reminders.scheduledAt));
    }

    // 6. Fetch Full Chat Transcript for this Lead
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.leadId, leadId))
      .orderBy(desc(conversations.createdAt))
      .limit(1);

    let chatMessages: Array<{
      id: string;
      role: string;
      content: string;
      language: string;
      flagged: boolean;
      flagReason: string | null;
      latencyMs: number | null;
      factIds: string | null;
      payload: unknown | null;
      createdAt: Date;
    }> = [];

    if (conversation) {
      const rawMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(asc(messages.createdAt));

      chatMessages = rawMessages.map((m) => {
        let parsedPayload = null;
        if (m.payload) {
          try {
            parsedPayload = JSON.parse(m.payload);
          } catch {
            parsedPayload = null;
          }
        }
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          language: m.language,
          flagged: m.flagged,
          flagReason: m.flagReason,
          latencyMs: m.latencyMs,
          factIds: m.factIds,
          payload: parsedPayload,
          createdAt: m.createdAt,
        };
      });
    }

    // 7. Fetch Lead Priority Score (Executive privacy: executive sees only their own assigned lead score; Admin sees all)
    let score = null;
    const canViewScore =
      user.role === "admin" ||
      (user.role === "executive" && lead.assignedExecutiveId === user.userId);

    if (canViewScore) {
      const [leadScore] = await db
        .select({
          total: leadScores.total,
          tier: leadScores.tier,
          breakdown: leadScores.breakdown,
          dataCompleteness: leadScores.dataCompleteness,
          scoreVersion: leadScores.scoreVersion,
          computedAt: leadScores.computedAt,
        })
        .from(leadScores)
        .where(eq(leadScores.leadId, leadId))
        .limit(1);

      if (leadScore) {
        score = leadScore;
      }
    }

    return NextResponse.json({
      success: true,
      lead,
      project,
      assignedExecutive,
      handoff: latestHandoff || null,
      booking: activeBooking || null,
      reminders: bookingReminders,
      conversationId: conversation?.id || null,
      messages: chatMessages,
      score,
    });
  } catch (error) {
    console.error("GET /api/leads/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch lead details" },
      { status: 500 }
    );
  }
}
