import { eq, and, gt, gte, lte, isNull, sql, desc, asc, notInArray } from "drizzle-orm";
import { db } from "../../db";
import {
  visitSlots,
  bookings,
  leads,
  reminders,
  projects,
  users,
} from "../../db/schema";
import {
  FreeSlot,
  BookVisitResult,
  CancelBookingResult,
  RescheduleBookingResult,
  BookingOutcome,
} from "./types";
import { recomputeLeadScore } from "../scoring";

const BOOKING_CUTOFF_HOURS = 2;

export const bookingService = {
  /**
   * Lists free upcoming slots for a project.
   * Free status is DERIVED from bookings: must have no confirmed booking.
   * Enforces 2-hour minimum booking cutoff.
   */
  async listFreeSlots(options: {
    projectId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    dbOrTx?: typeof db;
  }): Promise<FreeSlot[]> {
    const client = options.dbOrTx || db;
    const now = new Date();
    const cutoffTime = new Date(now.getTime() + BOOKING_CUTOFF_HOURS * 3600 * 1000);

    const conditions = [
      gt(visitSlots.startsAt, cutoffTime),
      eq(visitSlots.status, "available"),
      isNull(bookings.id), // No confirmed booking!
    ];

    if (options.projectId) {
      conditions.push(eq(visitSlots.projectId, options.projectId));
    }

    if (options.from) {
      conditions.push(gte(visitSlots.startsAt, options.from));
    }

    if (options.to) {
      conditions.push(lte(visitSlots.startsAt, options.to));
    }

    // Join bookings with partial condition status = 'confirmed'
    const rows = await client
      .select({
        id: visitSlots.id,
        projectId: visitSlots.projectId,
        projectName: projects.name,
        executiveId: visitSlots.executiveId,
        executiveName: users.name,
        startsAt: visitSlots.startsAt,
        endsAt: visitSlots.endsAt,
        status: visitSlots.status,
      })
      .from(visitSlots)
      .leftJoin(
        bookings,
        and(eq(bookings.slotId, visitSlots.id), eq(bookings.status, "confirmed"))
      )
      .leftJoin(projects, eq(visitSlots.projectId, projects.id))
      .leftJoin(users, eq(visitSlots.executiveId, users.id))
      .where(and(...conditions))
      .orderBy(asc(visitSlots.startsAt))
      .limit(options.limit || 50);

    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName || undefined,
      executiveId: r.executiveId,
      executiveFirstName: r.executiveName ? r.executiveName.split(" ")[0] : null,
      startsAt: new Date(r.startsAt),
      endsAt: new Date(r.endsAt),
      status: r.status,
    }));
  },

  /**
   * Atomically books a visit slot for a lead.
   * Enforces:
   * 1. 2-hour cutoff and future slot check
   * 2. Lead DPDP consent and non-opted-out check
   * 3. Single confirmed booking per project for the same lead
   * 4. Strict DB level partial unique index (confirmed_slot_unique_idx)
   * 5. Automated 1-day and 2-hour reminder generation
   */
  async bookVisit(
    params: { slotId: string; leadId: string },
    dbOrTx: typeof db = db
  ): Promise<BookVisitResult> {
    const { slotId, leadId } = params;

    // Execute inside a database transaction
    const execute = async (tx: any): Promise<BookVisitResult> => {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() + BOOKING_CUTOFF_HOURS * 3600 * 1000);

      // 1. Lock slot row and verify slot existence
      const [slot] = await tx
        .select()
        .from(visitSlots)
        .where(eq(visitSlots.id, slotId))
        .for("update");

      if (!slot) {
        return {
          success: false,
          code: "SLOT_NOT_FOUND",
          message: "The requested visit slot does not exist.",
        };
      }

      if (slot.status !== "available" || slot.status === "blocked") {
        const alternativeSlots = await bookingService.listFreeSlots({
          projectId: slot.projectId,
          from: now,
          limit: 3,
          dbOrTx: tx,
        });

        return {
          success: false,
          code: "SLOT_TAKEN",
          message: "This slot is no longer available. Please select an alternative time.",
          alternativeSlots,
        };
      }

      const slotStart = new Date(slot.startsAt);

      if (slotStart <= now) {
        return {
          success: false,
          code: "PAST_SLOT",
          message: "Cannot book a visit slot in the past.",
        };
      }

      if (slotStart < cutoffTime) {
        return {
          success: false,
          code: "SLOT_UNDER_CUTOFF",
          message: "Slots within 2 hours of start time cannot be booked online.",
        };
      }

      // 2. Verify lead status and compliance
      const [lead] = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, leadId));

      if (!lead) {
        return {
          success: false,
          code: "LEAD_NOT_FOUND",
          message: "Lead record not found.",
        };
      }

      if (!lead.consentGiven) {
        return {
          success: false,
          code: "NO_CONSENT",
          message: "Affirmative DPDP consent is required before booking a site visit.",
        };
      }

      if (lead.optedOut) {
        return {
          success: false,
          code: "OPTED_OUT",
          message: "Lead has opted out of notifications and cannot schedule visits.",
        };
      }

      // 3. Verify lead does not already have an upcoming confirmed booking for the same project
      const existingProjectBookings = await tx
        .select({
          bookingId: bookings.id,
          startsAt: visitSlots.startsAt,
        })
        .from(bookings)
        .innerJoin(visitSlots, eq(bookings.slotId, visitSlots.id))
        .where(
          and(
            eq(bookings.leadId, leadId),
            eq(bookings.status, "confirmed"),
            eq(visitSlots.projectId, slot.projectId),
            gt(visitSlots.startsAt, now)
          )
        );

      if (existingProjectBookings.length > 0) {
        return {
          success: false,
          code: "ALREADY_BOOKED",
          message:
            "You already hold an upcoming confirmed site visit for this project. Please reschedule instead.",
          existingBookingId: existingProjectBookings[0].bookingId,
        };
      }

      // 4. Check if slot already has an active confirmed booking
      const [existingBooking] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.slotId, slotId), eq(bookings.status, "confirmed")));

      if (existingBooking) {
        const alternativeSlots = await bookingService.listFreeSlots({
          projectId: slot.projectId,
          from: now,
          limit: 3,
          dbOrTx: tx,
        });

        return {
          success: false,
          code: "SLOT_TAKEN",
          message: "This slot has already been booked by another buyer. Please select an alternative time.",
          alternativeSlots,
        };
      }

      // 5. Insert booking with DB-level partial unique index protection
      let createdBooking: any;
      try {
        const [inserted] = await tx
          .insert(bookings)
          .values({
            slotId,
            leadId,
            status: "confirmed",
          })
          .returning();
        createdBooking = inserted;
      } catch (err: any) {
        // Handle PostgreSQL unique index violation error (23505)
        if (
          err?.code === "23505" ||
          String(err?.message || "").includes("confirmed_slot_unique_idx")
        ) {
          const alternativeSlots = await bookingService.listFreeSlots({
            projectId: slot.projectId,
            from: now,
            limit: 3,
            dbOrTx: tx,
          });

          return {
            success: false,
            code: "SLOT_TAKEN",
            message:
              "This slot was just booked by another buyer. Please select an alternative time.",
            alternativeSlots,
          };
        }
        throw err;
      }

      // 6. Schedule Reminders:
      // - 1_day reminder (startsAt - 24 hours) if more than 24 hours away
      // - 2_hour reminder (startsAt - 2 hours) if more than 2 hours away
      const createdReminders: any[] = [];
      const msUntilSlot = slotStart.getTime() - now.getTime();

      const reminder1DayTime = new Date(slotStart.getTime() - 24 * 3600 * 1000);
      const reminder2HourTime = new Date(slotStart.getTime() - 2 * 3600 * 1000);

      // Only schedule 1-day reminder if visit is >= 24h away
      if (msUntilSlot >= 24 * 3600 * 1000) {
        const [r1] = await tx
          .insert(reminders)
          .values({
            bookingId: createdBooking.id,
            type: "1_day",
            scheduledAt: reminder1DayTime,
            status: "pending",
          })
          .returning();
        createdReminders.push(r1);
      }

      // Only schedule 2-hour reminder if visit is >= 2h away
      if (msUntilSlot >= 2 * 3600 * 1000) {
        const [r2] = await tx
          .insert(reminders)
          .values({
            bookingId: createdBooking.id,
            type: "2_hour",
            scheduledAt: reminder2HourTime,
            status: "pending",
          })
          .returning();
        createdReminders.push(r2);
      }

      // 7. Update lead status to visit_scheduled & assign executive if unassigned
      await tx
        .update(leads)
        .set({
          status: "visit_scheduled",
          assignedExecutiveId: lead.assignedExecutiveId || slot.executiveId,
          projectId: lead.projectId || slot.projectId,
          updatedAt: now,
        })
        .where(eq(leads.id, leadId));

      // Recompute Lead Priority Score idempotently
      try {
        await recomputeLeadScore(leadId, tx);
      } catch (err) {
        console.warn("Lead Priority Score recomputation note:", err);
      }

      return {
        success: true,
        booking: {
          id: createdBooking.id,
          slotId: createdBooking.slotId,
          leadId: createdBooking.leadId,
          status: "confirmed",
          createdAt: createdBooking.createdAt,
        },
        reminders: createdReminders.map((r) => ({
          id: r.id,
          type: r.type,
          scheduledAt: new Date(r.scheduledAt),
          status: r.status,
        })),
      };
    };

    // If already in a transaction, reuse it; otherwise open one
    if ((dbOrTx as any).transaction) {
      return (dbOrTx as any).transaction(execute);
    }
    return execute(dbOrTx);
  },

  /**
   * Cancels an existing booking and cancels its pending reminders.
   */
  async cancelBooking(
    params: { bookingId: string; reason?: string },
    dbOrTx: typeof db = db
  ): Promise<CancelBookingResult> {
    const { bookingId } = params;

    const execute = async (tx: any): Promise<CancelBookingResult> => {
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId));

      if (!booking) {
        return { success: false, code: "NOT_FOUND", message: "Booking not found." };
      }

      if (booking.status === "cancelled") {
        return { success: false, code: "ALREADY_CANCELLED", message: "Booking is already cancelled." };
      }

      if (booking.status === "visited" || booking.status === "no_show") {
        return {
          success: false,
          code: "ALREADY_COMPLETED",
          message: "Cannot cancel an appointment that has already taken place.",
        };
      }

      // Update booking status to cancelled
      const [updated] = await tx
        .update(bookings)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(bookings.id, bookingId))
        .returning();

      // Cancel all pending reminders
      await tx
        .update(reminders)
        .set({ status: "cancelled" })
        .where(and(eq(reminders.bookingId, bookingId), eq(reminders.status, "pending")));

      // Recompute Lead Priority Score idempotently
      try {
        await recomputeLeadScore(booking.leadId, tx);
      } catch (err) {
        console.warn("Lead Priority Score recomputation note:", err);
      }

      return {
        success: true,
        booking: {
          id: updated.id,
          status: updated.status,
        },
      };
    };

    if ((dbOrTx as any).transaction) {
      return (dbOrTx as any).transaction(execute);
    }
    return execute(dbOrTx);
  },

  /**
   * Atomically reschedules a booking: cancels previous booking and creates new one in one transaction.
   * If the new booking cannot be made, transaction rolls back and previous booking remains intact.
   */
  async rescheduleBooking(
    params: { bookingId: string; newSlotId: string },
    dbOrTx: typeof db = db
  ): Promise<RescheduleBookingResult> {
    const { bookingId, newSlotId } = params;

    const execute = async (tx: any): Promise<RescheduleBookingResult> => {
      const [prevBooking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId));

      if (!prevBooking) {
        return { success: false, code: "NOT_FOUND", message: "Booking not found." };
      }

      if (prevBooking.slotId === newSlotId) {
        return {
          success: false,
          code: "SAME_SLOT",
          message: "Cannot reschedule to the same visit slot. Please select a different time.",
        };
      }

      if (prevBooking.status !== "confirmed") {
        return {
          success: false,
          code: "INVALID_STATUS",
          message: "Only confirmed visits can be rescheduled.",
        };
      }

      // 1. Cancel previous booking first so the project uniqueness check allows the new booking
      await tx
        .update(bookings)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(bookings.id, bookingId));

      await tx
        .update(reminders)
        .set({ status: "cancelled" })
        .where(and(eq(reminders.bookingId, bookingId), eq(reminders.status, "pending")));

      // 2. Book new slot
      const bookResult = await bookingService.bookVisit(
        { slotId: newSlotId, leadId: prevBooking.leadId },
        tx
      );

      if (!bookResult.success) {
        // Rollback entire transaction so old booking is restored!
        throw new Error(
          JSON.stringify({
            code: bookResult.code,
            message: bookResult.message,
            alternativeSlots: "alternativeSlots" in bookResult ? bookResult.alternativeSlots : [],
          })
        );
      }

      return {
        success: true,
        previousBookingId: bookingId,
        newBooking: {
          id: bookResult.booking.id,
          slotId: bookResult.booking.slotId,
          status: bookResult.booking.status,
        },
      };
    };

    try {
      if ((dbOrTx as any).transaction) {
        return await (dbOrTx as any).transaction(execute);
      }
      return await execute(dbOrTx);
    } catch (err: any) {
      try {
        const parsed = JSON.parse(err.message);
        return {
          success: false,
          code: parsed.code,
          message: parsed.message,
          alternativeSlots: parsed.alternativeSlots,
        };
      } catch {
        return {
          success: false,
          code: "RESCHEDULE_FAILED",
          message: err?.message || "Failed to reschedule booking.",
        };
      }
    }
  },

  /**
   * Marks a visit outcome: 'visited' or 'no_show'.
   * Executives can only mark their own assigned visit slots unless they are admins.
   */
  async markVisitOutcome(
    params: {
      bookingId: string;
      outcome: BookingOutcome;
      executiveId?: string;
      isAdmin?: boolean;
    },
    dbOrTx: typeof db = db
  ) {
    const { bookingId, outcome, executiveId, isAdmin } = params;

    const [row] = await dbOrTx
      .select({
        bookingId: bookings.id,
        leadId: bookings.leadId,
        slotExecutiveId: visitSlots.executiveId,
        startsAt: visitSlots.startsAt,
      })
      .from(bookings)
      .innerJoin(visitSlots, eq(bookings.slotId, visitSlots.id))
      .where(eq(bookings.id, bookingId));

    if (!row) {
      throw new Error("Booking not found.");
    }

    if (!isAdmin && executiveId && row.slotExecutiveId !== executiveId) {
      throw new Error("Forbidden: You can only update outcomes for your own assigned visit appointments.");
    }

    if (new Date(row.startsAt) > new Date()) {
      throw new Error("Cannot mark visit outcome before the scheduled appointment start time.");
    }

    // Update booking status
    const [updatedBooking] = await dbOrTx
      .update(bookings)
      .set({ status: outcome, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    // Update lead status: 'visited' if attended, or reset to 'qualified' for follow-up if no-show
    const newLeadStatus = outcome === "visited" ? ("visited" as const) : ("qualified" as const);
    await dbOrTx
      .update(leads)
      .set({ status: newLeadStatus, updatedAt: new Date() })
      .where(eq(leads.id, row.leadId));

    // Recompute Lead Priority Score idempotently
    try {
      await recomputeLeadScore(row.leadId, dbOrTx);
    } catch (err) {
      console.warn("Lead Priority Score recomputation note:", err);
    }

    return updatedBooking;
  },
};
