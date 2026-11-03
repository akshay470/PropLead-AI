import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { handoffs, leads, projects, users, conversations, bookings } from "@/server/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

/**
 * GET /api/executive/handoffs
 * Returns handoff requests for the authenticated sales executive or sales head (admin).
 * Filters: status = 'open' | 'done' | 'all'
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "executive" && user.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Executive or Admin access required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "open"; // 'open', 'done', 'all'

    // Build conditions
    const conditions = [];

    // Role-based scoping: executives only see their assigned handoffs
    if (user.role === "executive") {
      conditions.push(eq(handoffs.executiveId, user.userId));
    }

    if (statusFilter === "open") {
      conditions.push(inArray(handoffs.status, ["open", "contacted"]));
    } else if (statusFilter === "done") {
      conditions.push(eq(handoffs.status, "resolved"));
    }

    const rows = await db
      .select({
        id: handoffs.id,
        reason: handoffs.reason,
        status: handoffs.status,
        summary: handoffs.summary,
        notes: handoffs.notes,
        createdAt: handoffs.createdAt,
        resolvedAt: handoffs.resolvedAt,
        leadId: leads.id,
        leadName: leads.name,
        leadCode: leads.leadCode,
        leadPhone: leads.phoneE164,
        leadStatus: leads.status,
        leadWants: leads.wants,
        leadOptedOut: leads.optedOut,
        leadConsent: leads.consentGiven,
        projectId: projects.id,
        projectName: projects.name,
        projectLocation: projects.locationName,
        executiveId: users.id,
        executiveName: users.name,
        conversationId: conversations.id,
      })
      .from(handoffs)
      .innerJoin(leads, eq(handoffs.leadId, leads.id))
      .leftJoin(projects, eq(leads.projectId, projects.id))
      .innerJoin(users, eq(handoffs.executiveId, users.id))
      .leftJoin(conversations, eq(handoffs.conversationId, conversations.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(handoffs.createdAt));

    // Get active visit booking status for each lead
    const leadIds = rows.map((r) => r.leadId);
    let leadBookings: Array<{ leadId: string; status: string; startsAt: Date }> = [];
    if (leadIds.length > 0) {
      leadBookings = await db
        .select({
          leadId: bookings.leadId,
          status: bookings.status,
          startsAt: bookings.createdAt,
        })
        .from(bookings)
        .where(inArray(bookings.leadId, leadIds))
        .orderBy(desc(bookings.createdAt));
    }

    const bookingMap = new Map(leadBookings.map((b) => [b.leadId, b.status]));

    const formattedHandoffs = rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      summary: r.summary,
      notes: r.notes,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      lead: {
        id: r.leadId,
        name: r.leadName,
        leadCode: r.leadCode,
        phone: r.leadPhone,
        status: r.leadStatus,
        wants: r.leadWants,
        optedOut: r.leadOptedOut,
        consentGiven: r.leadConsent,
        visitStatus: bookingMap.get(r.leadId) || "none",
      },
      project: {
        id: r.projectId,
        name: r.projectName || "Company A Project",
        location: r.projectLocation,
      },
      executive: {
        id: r.executiveId,
        name: r.executiveName,
      },
      conversationId: r.conversationId,
    }));

    return NextResponse.json({
      success: true,
      handoffs: formattedHandoffs,
    });
  } catch (error) {
    console.error("GET /api/executive/handoffs error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching handoffs" },
      { status: 500 }
    );
  }
}
