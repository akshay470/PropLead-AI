import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import { applyMigrations } from "../helpers/db";
import { bookingService } from "@/server/services/booking";
import { reminderService } from "@/server/services/reminders/dispatcher";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";

describe("Booking Service & Double-Booking Protection", () => {
  let pg: PGlite;
  let testDb: any;
  let project1Id: string;
  let exec1Id: string;
  let exec2Id: string;
  let validLeadId: string;
  let noConsentLeadId: string;
  let optedOutLeadId: string;

  beforeAll(async () => {
    pg = new PGlite();
    testDb = drizzle(pg, { schema });

    // Apply real migrations from /drizzle
    await applyMigrations(pg);

    // Seed Base Project
    const [p1] = await testDb
      .insert(schema.projects)
      .values({
        name: "Project 1",
        reraNumber: "PR/GJ/AHMEDABAD/TEST-0001",
        locationName: "Bodakdev",
        lat: "23.0338",
        lng: "72.5072",
        address: "SG Highway, Bodakdev",
      })
      .returning();
    project1Id = p1.id;

    // Seed Executives
    const [e1, e2] = await testDb
      .insert(schema.users)
      .values([
        {
          name: "Rajesh Sharma",
          email: "rajesh.test@example.com",
          passwordHash: "hash123",
          role: "executive",
        },
        {
          name: "Ananya Shah",
          email: "ananya.test@example.com",
          passwordHash: "hash123",
          role: "executive",
        },
      ])
      .returning();
    exec1Id = e1.id;
    exec2Id = e2.id;

    // Seed Leads
    const [l1, l2, l3] = await testDb
      .insert(schema.leads)
      .values([
        {
          leadCode: "LD-90001",
          name: "Valid Buyer",
          phoneE164: "+919825100001",
          source: "website",
          projectId: project1Id,
          consentGiven: true,
          optedOut: false,
        },
        {
          leadCode: "LD-90002",
          name: "No Consent Buyer",
          phoneE164: "+919825100002",
          source: "website",
          projectId: project1Id,
          consentGiven: false,
          optedOut: false,
        },
        {
          leadCode: "LD-90003",
          name: "Opted Out Buyer",
          phoneE164: "+919825100003",
          source: "website",
          projectId: project1Id,
          consentGiven: true,
          optedOut: true,
        },
      ])
      .returning();
    validLeadId = l1.id;
    noConsentLeadId = l2.id;
    optedOutLeadId = l3.id;
  });

  afterAll(async () => {
    await pg.close();
  });

  it("should list only future free slots and exclude slots booked or under 2-hour cutoff", async () => {
    const now = new Date();

    // 1. Slot under 2 hours away (e.g. 1 hour from now)
    const slotUnderCutoff = new Date(now.getTime() + 60 * 60 * 1000);
    // 2. Future valid free slot (e.g. 5 hours from now)
    const slotValid = new Date(now.getTime() + 5 * 3600 * 1000);
    // 3. Past slot
    const slotPast = new Date(now.getTime() - 24 * 3600 * 1000);

    const [s1, s2, s3] = await testDb
      .insert(schema.visitSlots)
      .values([
        {
          projectId: project1Id,
          executiveId: exec1Id,
          startsAt: slotUnderCutoff,
          endsAt: new Date(slotUnderCutoff.getTime() + 3600 * 1000),
          status: "available",
        },
        {
          projectId: project1Id,
          executiveId: exec1Id,
          startsAt: slotValid,
          endsAt: new Date(slotValid.getTime() + 3600 * 1000),
          status: "available",
        },
        {
          projectId: project1Id,
          executiveId: exec1Id,
          startsAt: slotPast,
          endsAt: new Date(slotPast.getTime() + 3600 * 1000),
          status: "available",
        },
      ])
      .returning();

    const freeSlots = await bookingService.listFreeSlots({
      projectId: project1Id,
      dbOrTx: testDb,
    });

    const slotIds = freeSlots.map((s) => s.id);
    expect(slotIds).toContain(s2.id); // valid slot included
    expect(slotIds).not.toContain(s1.id); // under cutoff excluded
    expect(slotIds).not.toContain(s3.id); // past slot excluded
  });

  it("should reject booking for lead without consent or opted out", async () => {
    const futureTime = new Date(Date.now() + 24 * 3600 * 1000);
    const [testSlot] = await testDb
      .insert(schema.visitSlots)
      .values({
        projectId: project1Id,
        executiveId: exec1Id,
        startsAt: futureTime,
        endsAt: new Date(futureTime.getTime() + 3600 * 1000),
        status: "available",
      })
      .returning();

    // No consent lead
    const resNoConsent = await bookingService.bookVisit(
      { slotId: testSlot.id, leadId: noConsentLeadId },
      testDb
    );
    expect(resNoConsent.success).toBe(false);
    if (!resNoConsent.success) {
      expect(resNoConsent.code).toBe("NO_CONSENT");
    }

    // Opted out lead
    const resOptedOut = await bookingService.bookVisit(
      { slotId: testSlot.id, leadId: optedOutLeadId },
      testDb
    );
    expect(resOptedOut.success).toBe(false);
    if (!resOptedOut.success) {
      expect(resOptedOut.code).toBe("OPTED_OUT");
    }
  });

  it("should successfully book a slot, create reminders, and prevent duplicate bookings for same project", async () => {
    const futureTime = new Date(Date.now() + 48 * 3600 * 1000); // 48 hours away
    const [slotA] = await testDb
      .insert(schema.visitSlots)
      .values({
        projectId: project1Id,
        executiveId: exec1Id,
        startsAt: futureTime,
        endsAt: new Date(futureTime.getTime() + 3600 * 1000),
        status: "available",
      })
      .returning();

    const result = await bookingService.bookVisit(
      { slotId: slotA.id, leadId: validLeadId },
      testDb
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.booking.status).toBe("confirmed");
      // Since visit is 48h away, both 1_day and 2_hour reminders should be scheduled
      expect(result.reminders.length).toBe(2);
      expect(result.reminders.some((r) => r.type === "1_day")).toBe(true);
      expect(result.reminders.some((r) => r.type === "2_hour")).toBe(true);
    }

    // Lead tries to book ANOTHER slot for the same project
    const anotherSlotTime = new Date(Date.now() + 72 * 3600 * 1000);
    const [slotB] = await testDb
      .insert(schema.visitSlots)
      .values({
        projectId: project1Id,
        executiveId: exec2Id,
        startsAt: anotherSlotTime,
        endsAt: new Date(anotherSlotTime.getTime() + 3600 * 1000),
        status: "available",
      })
      .returning();

    const secondBookingRes = await bookingService.bookVisit(
      { slotId: slotB.id, leadId: validLeadId },
      testDb
    );

    expect(secondBookingRes.success).toBe(false);
    if (!secondBookingRes.success) {
      expect(secondBookingRes.code).toBe("ALREADY_BOOKED");
    }
  });

  it("should cancel booking, cancel pending reminders, and allow the slot to be rebooked", async () => {
    // 1. Create fresh lead and slot
    const [buyer] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-90004",
        name: "Cancel Test Buyer",
        phoneE164: "+919825100004",
        source: "website",
        consentGiven: true,
      })
      .returning();

    const slotTime = new Date(Date.now() + 36 * 3600 * 1000);
    const [slot] = await testDb
      .insert(schema.visitSlots)
      .values({
        projectId: project1Id,
        executiveId: exec1Id,
        startsAt: slotTime,
        endsAt: new Date(slotTime.getTime() + 3600 * 1000),
        status: "available",
      })
      .returning();

    // Book
    const bookRes = await bookingService.bookVisit(
      { slotId: slot.id, leadId: buyer.id },
      testDb
    );
    expect(bookRes.success).toBe(true);
    const bookingId = (bookRes as any).booking.id;

    // Cancel
    const cancelRes = await bookingService.cancelBooking({ bookingId }, testDb);
    expect(cancelRes.success).toBe(true);

    // Verify reminders cancelled
    const activeReminders = await testDb
      .select()
      .from(schema.reminders)
      .where(
        and(
          eq(schema.reminders.bookingId, bookingId),
          eq(schema.reminders.status, "pending")
        )
      );
    expect(activeReminders.length).toBe(0);

    // Verify slot can be booked again by another lead!
    const [buyer2] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-90005",
        name: "Second Buyer",
        phoneE164: "+919825100005",
        source: "website",
        consentGiven: true,
      })
      .returning();

    const rebookRes = await bookingService.bookVisit(
      { slotId: slot.id, leadId: buyer2.id },
      testDb
    );
    expect(rebookRes.success).toBe(true);
  });

  it("should atomically reschedule a booking and rollback if target slot is invalid", async () => {
    const [buyer] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-90006",
        name: "Reschedule Buyer",
        phoneE164: "+919825100006",
        source: "website",
        consentGiven: true,
      })
      .returning();

    const time1 = new Date(Date.now() + 40 * 3600 * 1000);
    const time2 = new Date(Date.now() + 44 * 3600 * 1000);

    const [slot1, slot2] = await testDb
      .insert(schema.visitSlots)
      .values([
        {
          projectId: project1Id,
          executiveId: exec1Id,
          startsAt: time1,
          endsAt: new Date(time1.getTime() + 3600 * 1000),
        },
        {
          projectId: project1Id,
          executiveId: exec2Id,
          startsAt: time2,
          endsAt: new Date(time2.getTime() + 3600 * 1000),
        },
      ])
      .returning();

    // Initial booking
    const book1 = await bookingService.bookVisit(
      { slotId: slot1.id, leadId: buyer.id },
      testDb
    );
    expect(book1.success).toBe(true);
    const booking1Id = (book1 as any).booking.id;

    // Reschedule to slot 2
    const resched = await bookingService.rescheduleBooking(
      { bookingId: booking1Id, newSlotId: slot2.id },
      testDb
    );
    expect(resched.success).toBe(true);

    // Verify original booking is cancelled and new booking is confirmed
    const [oldRow] = await testDb
      .select({ status: schema.bookings.status })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, booking1Id));
    expect(oldRow.status).toBe("cancelled");
  });

  it("should prevent unauthorized executive from marking outcome of another executive's booking", async () => {
    const [buyer] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-90007",
        name: "Outcome Buyer",
        phoneE164: "+919825100007",
        source: "website",
        consentGiven: true,
      })
      .returning();

    const time = new Date(Date.now() + 30 * 3600 * 1000);
    const [slot] = await testDb
      .insert(schema.visitSlots)
      .values({
        projectId: project1Id,
        executiveId: exec1Id, // Assigned to Rajesh Sharma (exec1)
        startsAt: time,
        endsAt: new Date(time.getTime() + 3600 * 1000),
      })
      .returning();

    const bookRes = await bookingService.bookVisit(
      { slotId: slot.id, leadId: buyer.id },
      testDb
    );
    const bookingId = (bookRes as any).booking.id;

    // Executive 2 (Ananya Shah) attempts to update outcome -> should reject!
    await expect(
      bookingService.markVisitOutcome(
        {
          bookingId,
          outcome: "visited",
          executiveId: exec2Id, // Not assigned executive!
          isAdmin: false,
        },
        testDb
      )
    ).rejects.toThrow("Forbidden");

    // Slot startsAt is moved to the past to simulate the completed visit
    await testDb
      .update(schema.visitSlots)
      .set({ startsAt: new Date(Date.now() - 3600 * 1000) })
      .where(eq(schema.visitSlots.id, slot.id));

    // Executive 1 (Rajesh Sharma) updates outcome -> succeeds!
    const updated = await bookingService.markVisitOutcome(
      {
        bookingId,
        outcome: "visited",
        executiveId: exec1Id,
        isAdmin: false,
      },
      testDb
    );
    expect(updated.status).toBe("visited");
  });

  it("should dispatch due reminders, skip opted-out leads and cancelled visits, and run idempotently", async () => {
    // Seed lead and confirmed booking with due reminder
    const [lead] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-90008",
        name: "Reminder Buyer",
        phoneE164: "+919825100008",
        source: "website",
        consentGiven: true,
      })
      .returning();

    const visitTime = new Date(Date.now() + 24 * 3600 * 1000);
    const [slot] = await testDb
      .insert(schema.visitSlots)
      .values({
        projectId: project1Id,
        executiveId: exec1Id,
        startsAt: visitTime,
        endsAt: new Date(visitTime.getTime() + 3600 * 1000),
      })
      .returning();

    const [booking] = await testDb
      .insert(schema.bookings)
      .values({
        slotId: slot.id,
        leadId: lead.id,
        status: "confirmed",
      })
      .returning();

    // Create a reminder that is due right now
    const [reminder] = await testDb
      .insert(schema.reminders)
      .values({
        bookingId: booking.id,
        type: "1_day",
        scheduledAt: new Date(Date.now() - 60 * 1000), // scheduled 1 min ago
        status: "pending",
      })
      .returning();

    // Dispatch reminders
    const run1 = await reminderService.dispatchDueReminders(new Date(), testDb);
    expect(run1.sent).toBeGreaterThanOrEqual(1);

    // Verify reminder status transitioned to 'sent'
    const [updatedReminder] = await testDb
      .select({ status: schema.reminders.status, sentAt: schema.reminders.sentAt })
      .from(schema.reminders)
      .where(eq(schema.reminders.id, reminder.id));
    expect(updatedReminder.status).toBe("sent");
    expect(updatedReminder.sentAt).not.toBeNull();

    // Dispatching a second time should send 0 (Idempotent!)
    const run2 = await reminderService.dispatchDueReminders(new Date(), testDb);
    expect(run2.sent).toBe(0);
  });

  describe("Strict Concurrency & Double-Booking Protection (10 Parallel Requests)", () => {
    it("should handle 10 concurrent booking requests for the SAME slot with exactly 1 success and 9 SLOT_TAKEN results", async () => {
      // 1. Create 10 distinct leads with consent
      const candidateLeads = [];
      for (let i = 0; i < 10; i++) {
        const [lead] = await testDb
          .insert(schema.leads)
          .values({
            leadCode: `LD-CONC-${i}`,
            name: `Candidate ${i}`,
            phoneE164: `+9198259000${String(i).padStart(2, "0")}`,
            source: "website",
            consentGiven: true,
          })
          .returning();
        candidateLeads.push(lead);
      }

      // 2. Create one single competitive slot 50 hours away
      const slotTime = new Date(Date.now() + 50 * 3600 * 1000);
      const [contestedSlot] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId: project1Id,
          executiveId: exec1Id,
          startsAt: slotTime,
          endsAt: new Date(slotTime.getTime() + 3600 * 1000),
          status: "available",
        })
        .returning();

      // 3. Fire 10 parallel bookVisit calls simultaneously for contestedSlot
      const bookingPromises = candidateLeads.map((lead) =>
        bookingService.bookVisit(
          { slotId: contestedSlot.id, leadId: lead.id },
          testDb
        )
      );

      const results = await Promise.all(bookingPromises);

      const successfulBookings = results.filter((r) => r.success);
      const slotTakenResults = results.filter((r) => !r.success && r.code === "SLOT_TAKEN");

      expect(successfulBookings.length).toBe(1);
      expect(slotTakenResults.length).toBe(9);

      // Verify at the database level that exactly 1 confirmed booking exists for this slot
      const dbBookings = await testDb
        .select()
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.slotId, contestedSlot.id),
            eq(schema.bookings.status, "confirmed")
          )
        );
      expect(dbBookings.length).toBe(1);
    });

    // Real PostgreSQL Connection Pool Concurrency Test (when TEST_DATABASE_URL is set)
    it.runIf(Boolean(process.env.TEST_DATABASE_URL))(
      "should enforce strict double-booking prevention on real multi-connection Postgres pool",
      async () => {
        const testDbUrl = process.env.TEST_DATABASE_URL!;
        const testRequiresSsl =
          testDbUrl.includes("sslmode=require") ||
          testDbUrl.includes("sslmode=verify-full") ||
          testDbUrl.includes("ssl=true") ||
          testDbUrl.includes("ssl=require");
        const sqlClient = postgres(testDbUrl, { max: 10, ssl: testRequiresSsl ? "require" : undefined });
        const poolDb = drizzlePg(sqlClient, { schema });

        try {
          // Verify partial unique index is active on real postgres
          const [testSlot] = await poolDb
            .insert(schema.visitSlots)
            .values({
              projectId: project1Id,
              startsAt: new Date(Date.now() + 60 * 3600 * 1000),
              endsAt: new Date(Date.now() + 61 * 3600 * 1000),
              status: "available",
            })
            .returning();

          const [leadA, leadB] = await poolDb
            .insert(schema.leads)
            .values([
              {
                leadCode: "LD-POOL-1",
                name: "Pool Lead A",
                phoneE164: "+919825999001",
                source: "website",
                consentGiven: true,
              },
              {
                leadCode: "LD-POOL-2",
                name: "Pool Lead B",
                phoneE164: "+919825999002",
                source: "website",
                consentGiven: true,
              },
            ])
            .returning();

          const results = await Promise.all([
            bookingService.bookVisit({ slotId: testSlot.id, leadId: leadA.id }, poolDb as any),
            bookingService.bookVisit({ slotId: testSlot.id, leadId: leadB.id }, poolDb as any),
          ]);

          const successes = results.filter((r) => r.success);
          const failures = results.filter((r) => !r.success && r.code === "SLOT_TAKEN");

          expect(successes.length).toBe(1);
          expect(failures.length).toBe(1);
        } finally {
          await sqlClient.end();
        }
      }
    );
  });
});
