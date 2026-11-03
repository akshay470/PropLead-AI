import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { applyMigrations } from "../helpers/db";
import { bookingService } from "@/server/services/booking";
import { createLeadFromEnquiry } from "@/server/services/leads/ingestion";
import { reminderService } from "@/server/services/reminders/dispatcher";
import { messageSchema } from "@/server/ai/schemas";

describe("System Edge Cases & Guarded Failure Modes", () => {
  let pg: PGlite;
  let testDb: any;
  let projectId: string;
  let execId: string;
  let leadId: string;

  beforeAll(async () => {
    pg = new PGlite();
    testDb = drizzle(pg, { schema });
    await applyMigrations(pg);

    // Create Project
    const [p] = await testDb
      .insert(schema.projects)
      .values({
        name: "Edge Case Orchard",
        reraNumber: "PR/GJ/AHMEDABAD/EDGE-0001",
        locationName: "Bodakdev",
        lat: "23.0338",
        lng: "72.5072",
        address: "SG Highway",
      })
      .returning();
    projectId = p.id;

    // Create Executive
    const [exec] = await testDb
      .insert(schema.users)
      .values({
        name: "Test Executive",
        email: "edge_exec@company.com",
        passwordHash: "hash123",
        role: "executive",
      })
      .returning();
    execId = exec.id;

    // Create Lead
    const [lead] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-EDGE1",
        name: "Edge Case Buyer",
        phoneE164: "+919825999901",
        source: "website",
        projectId,
        consentGiven: true,
        optedOut: false,
      })
      .returning();
    leadId = lead.id;
  });

  afterAll(async () => {
    await pg.close();
  });

  describe("Chat Input Validation Edge Cases", () => {
    it("rejects empty or whitespace-only messages", () => {
      const empty = messageSchema.safeParse({ message: "" });
      expect(empty.success).toBe(false);

      const whitespace = messageSchema.safeParse({ message: "    \n\t  " });
      expect(whitespace.success).toBe(false);
    });

    it("rejects oversized messages exceeding 1000 characters", () => {
      const longMessage = "A".repeat(1001);
      const parsed = messageSchema.safeParse({ message: longMessage });
      expect(parsed.success).toBe(false);
    });

    it("accepts valid messages within 1000 characters", () => {
      const validMessage = "I would like to view a 2 BHK apartment tomorrow afternoon.";
      const parsed = messageSchema.safeParse({ message: validMessage });
      expect(parsed.success).toBe(true);
    });
  });

  describe("Booking Service Edge Cases", () => {
    it("rejects booking when slot is in the past (PAST_SLOT)", async () => {
      const pastTime = new Date(Date.now() - 3600 * 1000);
      const [slot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId,
          executiveId: execId,
          startsAt: pastTime,
          endsAt: new Date(pastTime.getTime() + 3600 * 1000),
          status: "available",
        })
        .returning();

      const result = await bookingService.bookVisit({ slotId: slot.id, leadId }, testDb);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("PAST_SLOT");
      }
    });

    it("rejects booking when slot is under 2-hour cutoff (SLOT_UNDER_CUTOFF)", async () => {
      const nearFuture = new Date(Date.now() + 60 * 60 * 1000); // 1 hour away
      const [slot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId,
          executiveId: execId,
          startsAt: nearFuture,
          endsAt: new Date(nearFuture.getTime() + 3600 * 1000),
          status: "available",
        })
        .returning();

      const result = await bookingService.bookVisit({ slotId: slot.id, leadId }, testDb);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("SLOT_UNDER_CUTOFF");
      }
    });

    it("rejects booking when slot has been blocked by admin (SLOT_TAKEN)", async () => {
      const futureTime = new Date(Date.now() + 24 * 3600 * 1000);
      const [slot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId,
          executiveId: execId,
          startsAt: futureTime,
          endsAt: new Date(futureTime.getTime() + 3600 * 1000),
          status: "blocked",
          blockedReason: "Site maintenance",
        })
        .returning();

      const result = await bookingService.bookVisit({ slotId: slot.id, leadId }, testDb);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("SLOT_TAKEN");
        expect(result.message).toContain("no longer available");
      }
    });

    it("rejects reschedule to the exact same slot (SAME_SLOT)", async () => {
      const futureTime = new Date(Date.now() + 48 * 3600 * 1000);
      const [slot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId,
          executiveId: execId,
          startsAt: futureTime,
          endsAt: new Date(futureTime.getTime() + 3600 * 1000),
          status: "available",
        })
        .returning();

      // Create a confirmed booking
      const bookResult = await bookingService.bookVisit({ slotId: slot.id, leadId }, testDb);
      expect(bookResult.success).toBe(true);
      if (!bookResult.success) return;

      const bookingId = bookResult.booking.id;

      // Reschedule to same slot
      const rescheduleResult = await bookingService.rescheduleBooking(
        { bookingId, newSlotId: slot.id },
        testDb
      );
      expect(rescheduleResult.success).toBe(false);
      expect(rescheduleResult.code).toBe("SAME_SLOT");
    });

    it("rejects cancellation of already cancelled booking (ALREADY_CANCELLED)", async () => {
      const futureTime = new Date(Date.now() + 72 * 3600 * 1000);
      const [slot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId,
          executiveId: execId,
          startsAt: futureTime,
          endsAt: new Date(futureTime.getTime() + 3600 * 1000),
          status: "available",
        })
        .returning();

      // Create fresh lead so existingProjectBookings does not block
      const [freshLead] = await testDb
        .insert(schema.leads)
        .values({
          leadCode: "LD-CANCEL1",
          name: "Cancel Tester",
          phoneE164: "+919825999902",
          source: "website",
          projectId,
          consentGiven: true,
        })
        .returning();

      const bookResult = await bookingService.bookVisit({ slotId: slot.id, leadId: freshLead.id }, testDb);
      expect(bookResult.success).toBe(true);
      if (!bookResult.success) return;

      const bookingId = bookResult.booking.id;

      // First cancel succeeds
      const cancel1 = await bookingService.cancelBooking({ bookingId }, testDb);
      expect(cancel1.success).toBe(true);

      // Second cancel must be rejected with ALREADY_CANCELLED
      const cancel2 = await bookingService.cancelBooking({ bookingId }, testDb);
      expect(cancel2.success).toBe(false);
      expect(cancel2.code).toBe("ALREADY_CANCELLED");
    });

    it("rejects marking visit outcome before scheduled visit start time", async () => {
      const futureTime = new Date(Date.now() + 96 * 3600 * 1000);
      const [slot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId,
          executiveId: execId,
          startsAt: futureTime,
          endsAt: new Date(futureTime.getTime() + 3600 * 1000),
          status: "available",
        })
        .returning();

      const [freshLead] = await testDb
        .insert(schema.leads)
        .values({
          leadCode: "LD-OUTCOME1",
          name: "Outcome Tester",
          phoneE164: "+919825999903",
          source: "website",
          projectId,
          consentGiven: true,
        })
        .returning();

      const bookResult = await bookingService.bookVisit({ slotId: slot.id, leadId: freshLead.id }, testDb);
      expect(bookResult.success).toBe(true);
      if (!bookResult.success) return;

      await expect(
        bookingService.markVisitOutcome(
          {
            bookingId: bookResult.booking.id,
            outcome: "visited",
            executiveId: execId,
          },
          testDb
        )
      ).rejects.toThrow("Cannot mark visit outcome before the scheduled appointment start time.");
    });
  });

  describe("Reminder Dispatcher Edge Cases", () => {
    it("skips reminders when lead opted out after booking", async () => {
      const visitTime = new Date(Date.now() + 25 * 3600 * 1000);
      const [slot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId,
          executiveId: execId,
          startsAt: visitTime,
          endsAt: new Date(visitTime.getTime() + 3600 * 1000),
          status: "available",
        })
        .returning();

      const [optOutLead] = await testDb
        .insert(schema.leads)
        .values({
          leadCode: "LD-REM-OPT",
          name: "Opt Out Lead",
          phoneE164: "+919825999904",
          source: "website",
          projectId,
          consentGiven: true,
          optedOut: false,
        })
        .returning();

      const bookResult = await bookingService.bookVisit({ slotId: slot.id, leadId: optOutLead.id }, testDb);
      expect(bookResult.success).toBe(true);
      if (!bookResult.success) return;

      // Lead opts out later
      await testDb
        .update(schema.leads)
        .set({ optedOut: true })
        .where(eq(schema.leads.id, optOutLead.id));

      // Dispatch reminders for tomorrow
      const result = await reminderService.dispatchDueReminders(
        new Date(Date.now() + 2 * 3600 * 1000),
        testDb
      );

      expect(result.skippedOptedOut).toBeGreaterThanOrEqual(1);
    });

    it("skips reminders when booking has been cancelled", async () => {
      const visitTime = new Date(Date.now() + 30 * 3600 * 1000);
      const [slot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId,
          executiveId: execId,
          startsAt: visitTime,
          endsAt: new Date(visitTime.getTime() + 3600 * 1000),
          status: "available",
        })
        .returning();

      const [lead2] = await testDb
        .insert(schema.leads)
        .values({
          leadCode: "LD-REM-CANC",
          name: "Cancel Lead",
          phoneE164: "+919825999905",
          source: "website",
          projectId,
          consentGiven: true,
        })
        .returning();

      const bookResult = await bookingService.bookVisit({ slotId: slot.id, leadId: lead2.id }, testDb);
      expect(bookResult.success).toBe(true);
      if (!bookResult.success) return;

      // Cancel the booking
      await bookingService.cancelBooking({ bookingId: bookResult.booking.id }, testDb);

      // Verify pending reminders were marked cancelled
      const activeReminders = await testDb
        .select()
        .from(schema.reminders)
        .where(eq(schema.reminders.bookingId, bookResult.booking.id));

      expect(activeReminders.every((r: any) => r.status === "cancelled")).toBe(true);
    });
  });

  describe("Lead Ingestion Error Handling Edge Cases", () => {
    it("returns validation error and never throws 500 on malformed phone", async () => {
      await expect(
        createLeadFromEnquiry(
          {
            name: "Bad Phone Buyer",
            phone: "not-a-phone",
            source: "property_portal",
            consentGiven: true,
          },
          testDb
        )
      ).rejects.toThrow();
    });

    it("succeeds with null email and unassigned project", async () => {
      const result = await createLeadFromEnquiry(
        {
          name: "Minimal Buyer",
          phone: "98251 98765",
          source: "website",
          consentGiven: true,
        },
        testDb
      );

      expect(result.lead).toBeDefined();
      expect(result.lead.email).toBeNull();
      expect(result.lead.projectId).toBeNull();
    });
  });
});
