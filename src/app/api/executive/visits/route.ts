import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { bookings, visitSlots, leads, projects, users } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "executive" && user.role !== "admin" && !user.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Executive access required" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filterType = searchParams.get("type") || "all"; // 'upcoming', 'past', or 'all'

  // Build query
  const query = db
    .select({
      id: bookings.id,
      status: bookings.status,
      createdAt: bookings.createdAt,
      slotId: visitSlots.id,
      startsAt: visitSlots.startsAt,
      endsAt: visitSlots.endsAt,
      projectId: projects.id,
      projectName: projects.name,
      projectAddress: projects.address,
      projectLat: projects.lat,
      projectLng: projects.lng,
      projectRera: projects.reraNumber,
      leadId: leads.id,
      leadCode: leads.leadCode,
      leadName: leads.name,
      leadPhone: leads.phoneE164,
      leadEmail: leads.email,
      leadWants: leads.wants,
      executiveId: visitSlots.executiveId,
      executiveName: users.name,
    })
    .from(bookings)
    .innerJoin(visitSlots, eq(bookings.slotId, visitSlots.id))
    .innerJoin(leads, eq(bookings.leadId, leads.id))
    .innerJoin(projects, eq(visitSlots.projectId, projects.id))
    .leftJoin(users, eq(visitSlots.executiveId, users.id))
    .orderBy(desc(visitSlots.startsAt));

  // If not admin, restrict to executive's own assigned slots
  const allRows = await query;
  const filtered = allRows.filter((row) => {
    if (!user.isAdmin && user.role !== "admin") {
      if (row.executiveId !== user.userId) return false;
    }
    const isUpcoming = new Date(row.startsAt) >= new Date();
    if (filterType === "upcoming") return isUpcoming;
    if (filterType === "past") return !isUpcoming;
    return true;
  });

  return NextResponse.json({
    success: true,
    visits: filtered,
  });
}
