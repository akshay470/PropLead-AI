import { db } from "@/server/db";
import {
  visitSlots,
  bookings,
  leads,
  users,
  projects,
  executiveProjects,
} from "@/server/db/schema";
import {
  BUSINESS_TIMEZONE,
  createIstDate,
  getIstParts,
  getIstMondayOfWeek,
  getIstRelativeDays,
  formatIstDateKey,
  formatIstDate,
  formatIstTime,
} from "@/lib/timezone";
import { eq, and, gte, lt, inArray, desc, asc, sql } from "drizzle-orm";

export interface WeekSlotsFilter {
  projectId?: string;
  executiveId?: string;
  weekStartIST?: string; // Format: YYYY-MM-DD (must be Monday or will compute Monday of that date)
}

export interface SlotGridItem {
  id: string;
  projectId: string;
  projectName: string;
  executiveId: string;
  executiveName: string;
  startsAt: Date;
  endsAt: Date;
  dateKey: string; // YYYY-MM-DD IST
  startHour: number; // 10..17
  timeLabel: string; // "10:00 AM – 11:00 AM IST"
  status: "available" | "booked" | "blocked";
  blockedReason?: string | null;
  booking?: {
    id: string;
    leadId: string;
    leadName: string;
    leadCode: string;
    phoneE164: string;
  } | null;
}

export interface GenerateSlotsInput {
  projectId: string;
  executiveIds: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysOfWeek?: number[]; // 1=Mon, 2=Tue, ..., 6=Sat, 0=Sun. Default: [1, 2, 3, 4, 5, 6]
  startHourIST?: number; // Default: 10
  endHourIST?: number; // Default: 18 (last slot 17:00-18:00)
}

/**
 * Service managing appointment visit slots, weekly scheduling grids,
 * idempotent slot creation, administrator blocks/unblocks, and project coverage.
 */
export class SlotManagementService {
  /**
   * Retrieves a structured 7-day week schedule grid for a given project/executive in Asia/Kolkata.
   */
  async getWeekSlotsGrid(filter: WeekSlotsFilter = {}, drizzleDb = db) {
    // 1. Determine Monday of the target week in IST
    let refDate = new Date();
    if (filter.weekStartIST) {
      const [y, m, d] = filter.weekStartIST.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        refDate = createIstDate(y, m, d, 12, 0, 0);
      }
    }
    const mondayIst = getIstMondayOfWeek(refDate);
    const mondayKey = formatIstDateKey(mondayIst);

    // 2. Generate 7 day columns (Mon to Sun)
    const days: Array<{
      dateKey: string;
      dateLabel: string;
      weekday: string;
      isToday: boolean;
    }> = [];

    const todayKey = formatIstDateKey(new Date());

    for (let i = 0; i < 7; i++) {
      const currentDay = getIstRelativeDays(i, 0, 0, mondayIst);
      const key = formatIstDateKey(currentDay);
      const parts = getIstParts(currentDay);
      days.push({
        dateKey: key,
        dateLabel: formatIstDate(currentDay),
        weekday: parts.weekday,
        isToday: key === todayKey,
      });
    }

    // 3. Time range bounds in UTC for the entire 7-day period
    const startRangeUtc = mondayIst; // 00:00:00 IST Monday
    const endRangeUtc = getIstRelativeDays(7, 0, 0, mondayIst); // 00:00:00 IST next Monday

    // 4. Query visit slots and join with executive, project, confirmed booking, and lead
    const conditions = [
      gte(visitSlots.startsAt, startRangeUtc),
      lt(visitSlots.startsAt, endRangeUtc),
    ];

    if (filter.projectId) {
      conditions.push(eq(visitSlots.projectId, filter.projectId));
    }
    if (filter.executiveId) {
      conditions.push(eq(visitSlots.executiveId, filter.executiveId));
    }

    const rawSlots = await drizzleDb
      .select({
        id: visitSlots.id,
        projectId: visitSlots.projectId,
        projectName: projects.name,
        executiveId: visitSlots.executiveId,
        executiveName: users.name,
        startsAt: visitSlots.startsAt,
        endsAt: visitSlots.endsAt,
        status: visitSlots.status,
        blockedReason: visitSlots.blockedReason,
        bookingId: bookings.id,
        bookingStatus: bookings.status,
        leadId: leads.id,
        leadName: leads.name,
        leadCode: leads.leadCode,
        leadPhone: leads.phoneE164,
      })
      .from(visitSlots)
      .innerJoin(projects, eq(visitSlots.projectId, projects.id))
      .innerJoin(users, eq(visitSlots.executiveId, users.id))
      .leftJoin(
        bookings,
        and(eq(bookings.slotId, visitSlots.id), eq(bookings.status, "confirmed"))
      )
      .leftJoin(leads, eq(bookings.leadId, leads.id))
      .where(and(...conditions))
      .orderBy(asc(visitSlots.startsAt));

    const gridSlots: SlotGridItem[] = rawSlots.map((s) => {
      const parts = getIstParts(s.startsAt);
      const dateKey = formatIstDateKey(s.startsAt);
      const isBooked = !!s.bookingId && s.bookingStatus === "confirmed";

      return {
        id: s.id,
        projectId: s.projectId,
        projectName: s.projectName,
        executiveId: s.executiveId || "",
        executiveName: s.executiveName,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        dateKey,
        startHour: parts.hour,
        timeLabel: `${formatIstTime(s.startsAt)} – ${formatIstTime(s.endsAt)} IST`,
        status: isBooked ? "booked" : s.status === "blocked" ? "blocked" : "available",
        blockedReason: s.blockedReason,
        booking: isBooked
          ? {
              id: s.bookingId!,
              leadId: s.leadId!,
              leadName: s.leadName || "Enquiry Buyer",
              leadCode: s.leadCode || "LD-00000",
              phoneE164: s.leadPhone || "",
            }
          : null,
      };
    });

    // 5. Fetch all executives and projects for UI dropdown selectors
    const allProjects = await drizzleDb
      .select({
        id: projects.id,
        name: projects.name,
        locationName: projects.locationName,
        address: projects.address,
        lat: projects.lat,
        lng: projects.lng,
      })
      .from(projects)
      .orderBy(asc(projects.name));

    const allExecutives = await drizzleDb
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.role, "executive"))
      .orderBy(asc(users.name));

    return {
      weekStartIST: mondayKey,
      weekEndIST: days[6].dateKey,
      days,
      hours: [10, 11, 12, 13, 14, 15, 16, 17], // 10:00 to 18:00 IST (60 min slots)
      slots: gridSlots,
      projects: allProjects,
      executives: allExecutives,
    };
  }

  /**
   * Idempotently generates 60-minute visit slots for a project and executive list
   * across a date range in Asia/Kolkata.
   * Uses ON CONFLICT DO NOTHING against unique index (executive_id, starts_at).
   */
  async generateSlots(input: GenerateSlotsInput, drizzleDb = db) {
    const {
      projectId,
      executiveIds,
      startDate,
      endDate,
      daysOfWeek = [1, 2, 3, 4, 5, 6], // Mon-Sat
      startHourIST = 10,
      endHourIST = 18,
    } = input;

    if (!executiveIds || executiveIds.length === 0) {
      throw new Error("At least one sales executive must be selected");
    }

    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

    const startBoundary = createIstDate(startYear, startMonth, startDay, 0, 0, 0);
    const endBoundary = createIstDate(endYear, endMonth, endDay, 23, 59, 59);

    if (startBoundary.getTime() > endBoundary.getTime()) {
      throw new Error("Start date cannot be after end date");
    }

    const slotsToInsert: Array<{
      projectId: string;
      executiveId: string;
      startsAt: Date;
      endsAt: Date;
      status: "available";
    }> = [];

    // Map short weekday string to 0..6 (0=Sun, 1=Mon, ..., 6=Sat)
    const weekdayToNumber: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    // Iterate through calendar days in IST
    let currentDayIter = new Date(startBoundary.getTime());
    while (currentDayIter.getTime() <= endBoundary.getTime()) {
      const parts = getIstParts(currentDayIter);
      const dayNum = weekdayToNumber[parts.weekday];

      if (daysOfWeek.includes(dayNum)) {
        for (const execId of executiveIds) {
          for (let h = startHourIST; h < endHourIST; h++) {
            const slotStart = createIstDate(parts.year, parts.month, parts.day, h, 0, 0);
            const slotEnd = createIstDate(parts.year, parts.month, parts.day, h + 1, 0, 0);

            slotsToInsert.push({
              projectId,
              executiveId: execId,
              startsAt: slotStart,
              endsAt: slotEnd,
              status: "available",
            });
          }
        }
      }

      // Increment by 1 day in IST
      currentDayIter = getIstRelativeDays(1, 0, 0, currentDayIter);
    }

    if (slotsToInsert.length === 0) {
      return {
        createdCount: 0,
        skippedCount: 0,
        totalCandidates: 0,
      };
    }

    // Insert with ON CONFLICT DO NOTHING
    const inserted = await drizzleDb
      .insert(visitSlots)
      .values(slotsToInsert)
      .onConflictDoNothing({
        target: [visitSlots.executiveId, visitSlots.startsAt],
      })
      .returning({ id: visitSlots.id });

    const createdCount = inserted.length;
    const skippedCount = slotsToInsert.length - createdCount;

    return {
      createdCount,
      skippedCount,
      totalCandidates: slotsToInsert.length,
    };
  }

  /**
   * Blocks a specific visit slot with a reason.
   * Throws an error if the slot has an active confirmed booking.
   */
  async blockSlot(slotId: string, reason?: string, drizzleDb = db) {
    // Check confirmed booking
    const activeBooking = await drizzleDb
      .select({
        bookingId: bookings.id,
        leadName: leads.name,
        leadCode: leads.leadCode,
      })
      .from(bookings)
      .innerJoin(leads, eq(bookings.leadId, leads.id))
      .where(and(eq(bookings.slotId, slotId), eq(bookings.status, "confirmed")))
      .limit(1);

    if (activeBooking.length > 0) {
      throw new Error(
        `Cannot block slot: Confirmed booking exists for lead ${activeBooking[0].leadCode} (${activeBooking[0].leadName}). Reschedule or cancel the visit first.`
      );
    }

    const [updated] = await drizzleDb
      .update(visitSlots)
      .set({
        status: "blocked",
        blockedReason: reason || "Blocked by administrator",
      })
      .where(eq(visitSlots.id, slotId))
      .returning();

    if (!updated) {
      throw new Error("Slot not found");
    }

    return updated;
  }

  /**
   * Unblocks a previously blocked slot.
   */
  async unblockSlot(slotId: string, drizzleDb = db) {
    const [updated] = await drizzleDb
      .update(visitSlots)
      .set({
        status: "available",
        blockedReason: null,
      })
      .where(eq(visitSlots.id, slotId))
      .returning();

    if (!updated) {
      throw new Error("Slot not found");
    }

    return updated;
  }

  /**
   * Blocks an executive's entire day in Asia/Kolkata (e.g. sick leave, training).
   * Blocks all unbooked slots and reports if any slots could not be blocked due to existing bookings.
   */
  async blockDay(executiveId: string, dateIST: string, reason?: string, drizzleDb = db) {
    const [year, month, day] = dateIST.split("-").map(Number);
    const dayStart = createIstDate(year, month, day, 0, 0, 0);
    const dayEnd = createIstDate(year, month, day + 1, 0, 0, 0);

    // Get all slots for that executive on that date
    const daySlots = await drizzleDb
      .select({
        slotId: visitSlots.id,
        startsAt: visitSlots.startsAt,
        bookingId: bookings.id,
        bookingStatus: bookings.status,
        leadCode: leads.leadCode,
        leadName: leads.name,
      })
      .from(visitSlots)
      .leftJoin(
        bookings,
        and(eq(bookings.slotId, visitSlots.id), eq(bookings.status, "confirmed"))
      )
      .leftJoin(leads, eq(bookings.leadId, leads.id))
      .where(
        and(
          eq(visitSlots.executiveId, executiveId),
          gte(visitSlots.startsAt, dayStart),
          lt(visitSlots.startsAt, dayEnd)
        )
      );

    const bookedSlots = daySlots.filter((s) => s.bookingId && s.bookingStatus === "confirmed");
    const unbookedSlotIds = daySlots
      .filter((s) => !s.bookingId || s.bookingStatus !== "confirmed")
      .map((s) => s.slotId);

    let blockedCount = 0;
    if (unbookedSlotIds.length > 0) {
      const updated = await drizzleDb
        .update(visitSlots)
        .set({
          status: "blocked",
          blockedReason: reason || "Full day leave / training",
        })
        .where(inArray(visitSlots.id, unbookedSlotIds))
        .returning();
      blockedCount = updated.length;
    }

    return {
      dateIST,
      blockedCount,
      skippedBookedCount: bookedSlots.length,
      bookedLeads: bookedSlots.map((b) => ({
        leadCode: b.leadCode,
        leadName: b.leadName,
        startsAt: b.startsAt,
      })),
    };
  }

  /**
   * Deletes an unbooked slot.
   * Throws an error if there is an active confirmed booking, preventing orphaned bookings.
   */
  async deleteSlot(slotId: string, drizzleDb = db) {
    const activeBooking = await drizzleDb
      .select({
        bookingId: bookings.id,
        leadName: leads.name,
        leadCode: leads.leadCode,
      })
      .from(bookings)
      .innerJoin(leads, eq(bookings.leadId, leads.id))
      .where(and(eq(bookings.slotId, slotId), eq(bookings.status, "confirmed")))
      .limit(1);

    if (activeBooking.length > 0) {
      throw new Error(
        `Cannot delete slot: Confirmed booking exists for lead ${activeBooking[0].leadCode} (${activeBooking[0].leadName}). Please reschedule or cancel the booking first.`
      );
    }

    // Also remove any historical cancelled / no-show booking records for this slot to avoid foreign key restriction
    await drizzleDb.delete(bookings).where(eq(bookings.slotId, slotId));

    const [deleted] = await drizzleDb
      .delete(visitSlots)
      .where(eq(visitSlots.id, slotId))
      .returning({ id: visitSlots.id });

    if (!deleted) {
      throw new Error("Slot not found or already deleted");
    }

    return { success: true, slotId: deleted.id };
  }

  /**
   * Retrieves executive project coverage assignments.
   */
  async getExecutiveCoverage(drizzleDb = db) {
    const executives = await drizzleDb
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.role, "executive"))
      .orderBy(asc(users.name));

    const allProjects = await drizzleDb
      .select({
        id: projects.id,
        name: projects.name,
      })
      .from(projects)
      .orderBy(asc(projects.name));

    const coverages = await drizzleDb
      .select({
        executiveId: executiveProjects.executiveId,
        projectId: executiveProjects.projectId,
      })
      .from(executiveProjects);

    const coverageMap: Record<string, string[]> = {};
    for (const c of coverages) {
      if (!coverageMap[c.executiveId]) {
        coverageMap[c.executiveId] = [];
      }
      coverageMap[c.executiveId].push(c.projectId);
    }

    return {
      projects: allProjects,
      executives: executives.map((e) => ({
        ...e,
        assignedProjectIds: coverageMap[e.id] || [],
      })),
    };
  }

  /**
   * Updates executive project coverage assignments.
   */
  async updateExecutiveCoverage(
    executiveId: string,
    projectIds: string[],
    drizzleDb = db
  ) {
    // Delete existing coverage
    await drizzleDb
      .delete(executiveProjects)
      .where(eq(executiveProjects.executiveId, executiveId));

    if (projectIds.length > 0) {
      await drizzleDb.insert(executiveProjects).values(
        projectIds.map((projectId) => ({
          executiveId,
          projectId,
        }))
      );
    }

    return {
      success: true,
      executiveId,
      assignedProjectIds: projectIds,
    };
  }

  /**
   * Updates project physical address and geographical coordinates.
   */
  async updateProjectLocation(
    projectId: string,
    data: { address: string; lat: number; lng: number },
    drizzleDb = db
  ) {
    const [updated] = await drizzleDb
      .update(projects)
      .set({
        address: data.address.trim(),
        lat: data.lat.toString(),
        lng: data.lng.toString(),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    if (!updated) {
      throw new Error("Project not found");
    }

    return updated;
  }
}

export const slotManagementService = new SlotManagementService();
