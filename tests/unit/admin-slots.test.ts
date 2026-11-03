import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import { applyMigrations } from "../helpers/db";
import { slotManagementService } from "@/server/services/booking/slot-management";
import { maskRecipient } from "@/lib/phone";
import { GET as getAdminMessages } from "@/app/api/admin/messages/route";
import { GET as getAdminSlots } from "@/app/api/admin/slots/route";
import { GET as getCoverage, POST as postCoverage } from "@/app/api/admin/coverage/route";
import * as cookiesModule from "@/server/auth/cookies";
import { NextRequest } from "next/server";
import { createIstDate, formatIstDateKey } from "@/lib/timezone";
import { eq } from "drizzle-orm";

vi.mock("@/server/auth/cookies", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Admin Slot Editor & Rota Management (Step 6)", () => {
  let pg: PGlite;
  let testDb: any;
  let project1Id: string;
  let exec1Id: string;
  let exec2Id: string;
  let sampleLeadId: string;

  beforeAll(async () => {
    pg = new PGlite();
    testDb = drizzle(pg, { schema });
    await applyMigrations(pg);

    // 1. Seed Sample Project
    const [p1] = await testDb
      .insert(schema.projects)
      .values({
        name: "Project 1 Bodakdev",
        reraNumber: "PR/GJ/AHMEDABAD/TEST-SLOT-001",
        locationName: "Bodakdev",
        lat: "23.0338",
        lng: "72.5072",
        address: "SG Highway, Bodakdev, Ahmedabad",
      })
      .returning();
    project1Id = p1.id;

    // 2. Seed Sales Executives
    const [e1, e2] = await testDb
      .insert(schema.users)
      .values([
        {
          name: "Rajesh Sharma",
          email: "rajesh.slots@test.com",
          passwordHash: "hash123",
          role: "executive",
        },
        {
          name: "Ananya Shah",
          email: "ananya.slots@test.com",
          passwordHash: "hash123",
          role: "executive",
        },
      ])
      .returning();
    exec1Id = e1.id;
    exec2Id = e2.id;

    // 3. Seed Sample Lead
    const [l] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-99991",
        name: "Vikram Patel",
        phoneE164: "+919825099991",
        email: "vikram@example.com",
        source: "website",
        projectId: project1Id,
        consentGiven: true,
      })
      .returning();
    sampleLeadId = l.id;
  });

  afterAll(async () => {
    await pg.close();
  });

  describe("Slot Generation Idempotency", () => {
    it("generates slots idempotently without duplication on re-run", async () => {
      // Choose a fixed test week in IST: Nov 9 to Nov 10, 2026 (Mon & Tue)
      // 2 days * 2 hours (10:00 & 11:00) * 2 executives = 8 slots
      const input = {
        projectId: project1Id,
        executiveIds: [exec1Id, exec2Id],
        startDate: "2026-11-09",
        endDate: "2026-11-10",
        daysOfWeek: [1, 2], // Mon and Tue
        startHourIST: 10,
        endHourIST: 12,
      };

      // First run: Should create exactly 8 slots
      const firstRun = await slotManagementService.generateSlots(input, testDb);
      expect(firstRun.createdCount).toBe(8);
      expect(firstRun.skippedCount).toBe(0);
      expect(firstRun.totalCandidates).toBe(8);

      // Second run with identical parameters: Should create 0 slots and skip 8
      const secondRun = await slotManagementService.generateSlots(input, testDb);
      expect(secondRun.createdCount).toBe(0);
      expect(secondRun.skippedCount).toBe(8);
      expect(secondRun.totalCandidates).toBe(8);
    });
  });

  describe("Slot Blocking & Unblocking", () => {
    let unbookedSlotId: string;
    let bookedSlotId: string;

    beforeAll(async () => {
      // Query one generated slot for unbooked testing
      const [slot1] = await testDb
        .select()
        .from(schema.visitSlots)
        .where(eq(schema.visitSlots.executiveId, exec1Id))
        .limit(1);
      unbookedSlotId = slot1.id;

      // Query another slot and create an active confirmed booking
      const [slot2] = await testDb
        .select()
        .from(schema.visitSlots)
        .where(eq(schema.visitSlots.executiveId, exec2Id))
        .limit(1);
      bookedSlotId = slot2.id;

      await testDb.insert(schema.bookings).values({
        slotId: bookedSlotId,
        leadId: sampleLeadId,
        status: "confirmed",
      });
    });

    it("successfully blocks an unbooked slot with a reason", async () => {
      const blocked = await slotManagementService.blockSlot(
        unbookedSlotId,
        "Dentist Appointment",
        testDb
      );
      expect(blocked.status).toBe("blocked");
      expect(blocked.blockedReason).toBe("Dentist Appointment");
    });

    it("unblocks a previously blocked slot", async () => {
      const unblocked = await slotManagementService.unblockSlot(unbookedSlotId, testDb);
      expect(unblocked.status).toBe("available");
      expect(unblocked.blockedReason).toBeNull();
    });

    it("refuses to block a slot with an active confirmed booking", async () => {
      await expect(
        slotManagementService.blockSlot(bookedSlotId, "Sudden Leave", testDb)
      ).rejects.toThrow(/Cannot block slot: Confirmed booking exists/);
    });
  });

  describe("Slot Deletion Protection", () => {
    let bookedSlotId: string;
    let standaloneSlotId: string;

    beforeAll(async () => {
      // Find the booked slot
      const [b] = await testDb.select().from(schema.bookings).limit(1);
      bookedSlotId = b.slotId;

      // Create a standalone slot for deletion test
      const slotStart = createIstDate(2026, 11, 20, 14, 0);
      const slotEnd = createIstDate(2026, 11, 20, 15, 0);
      const [standalone] = await testDb
        .insert(schema.visitSlots)
        .values({
          projectId: project1Id,
          executiveId: exec1Id,
          startsAt: slotStart,
          endsAt: slotEnd,
          status: "available",
        })
        .returning();
      standaloneSlotId = standalone.id;
    });

    it("refuses to delete a slot with an active confirmed booking", async () => {
      await expect(
        slotManagementService.deleteSlot(bookedSlotId, testDb)
      ).rejects.toThrow(/Cannot delete slot: Confirmed booking exists/);
    });

    it("successfully deletes an unbooked visit slot", async () => {
      const res = await slotManagementService.deleteSlot(standaloneSlotId, testDb);
      expect(res.success).toBe(true);
      expect(res.slotId).toBe(standaloneSlotId);

      const check = await testDb
        .select()
        .from(schema.visitSlots)
        .where(eq(schema.visitSlots.id, standaloneSlotId));
      expect(check.length).toBe(0);
    });
  });

  describe("Full Day Blocking for an Executive", () => {
    it("blocks unbooked slots on a target date and reports skipped bookings", async () => {
      const res = await slotManagementService.blockDay(
        exec2Id,
        "2026-11-09",
        "Full Day Sales Training",
        testDb
      );

      expect(res.dateIST).toBe("2026-11-09");
      // 1 slot was booked, so it must be preserved
      expect(res.skippedBookedCount).toBe(1);
      expect(res.bookedLeads.length).toBe(1);
      expect(res.bookedLeads[0].leadCode).toBe("LD-99991");
      expect(res.blockedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Executive Project Coverage Assignments", () => {
    it("manages and retrieves project coverage assignments for sales executives", async () => {
      await slotManagementService.updateExecutiveCoverage(
        exec1Id,
        [project1Id],
        testDb
      );

      const coverage = await slotManagementService.getExecutiveCoverage(testDb);
      const exec1 = coverage.executives.find((e) => e.id === exec1Id);
      expect(exec1).toBeDefined();
      expect(exec1?.assignedProjectIds).toContain(project1Id);
    });
  });

  describe("Project Physical Address & GPS Coordinates", () => {
    it("updates project address and lat/lng with valid numeric bounds", async () => {
      const updated = await slotManagementService.updateProjectLocation(
        project1Id,
        {
          address: "Survey No. 42, Bodakdev Crossroads, Ahmedabad 380054",
          lat: 23.034567,
          lng: 72.508912,
        },
        testDb
      );

      expect(updated.address).toContain("Bodakdev Crossroads");
      expect(Number(updated.lat)).toBeCloseTo(23.034567, 5);
      expect(Number(updated.lng)).toBeCloseTo(72.508912, 5);
    });
  });

  describe("Outbound Recipient Privacy Masking", () => {
    it("masks E.164 phone numbers preserving only last 4 digits", () => {
      expect(maskRecipient("+919825012345")).toBe("+91 ******2345");
      expect(maskRecipient("+919898099887")).toBe("+91 ******9887");
    });

    it("masks email addresses preserving user initial and domain", () => {
      expect(maskRecipient("ananya.buyer@gmail.com")).toBe("a***@gmail.com");
    });
  });

  describe("Admin Route Role-Based Access Control (RBAC)", () => {
    it("returns 401 when accessing GET /api/admin/slots unauthenticated", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3000/api/admin/slots");
      const res = await getAdminSlots(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when executive attempts to access GET /api/admin/slots", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: exec1Id,
        name: "Rajesh Sharma",
        email: "rajesh@example.com",
        role: "executive",
        isAdmin: false,
      });
      const req = new NextRequest("http://localhost:3000/api/admin/slots");
      const res = await getAdminSlots(req);
      expect(res.status).toBe(403);
    });

    it("returns 401 when accessing GET /api/admin/messages unauthenticated", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3000/api/admin/messages");
      const res = await getAdminMessages(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when executive attempts to access GET /api/admin/messages", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: exec1Id,
        name: "Rajesh Sharma",
        email: "rajesh@example.com",
        role: "executive",
        isAdmin: false,
      });
      const req = new NextRequest("http://localhost:3000/api/admin/messages");
      const res = await getAdminMessages(req);
      expect(res.status).toBe(403);
    });

    it("returns 403 when executive attempts to modify project coverage", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: exec1Id,
        name: "Rajesh Sharma",
        email: "rajesh@example.com",
        role: "executive",
        isAdmin: false,
      });
      const req = new NextRequest("http://localhost:3000/api/admin/coverage", {
        method: "POST",
        body: JSON.stringify({ executiveId: exec1Id, projectIds: [project1Id] }),
      });
      const res = await postCoverage(req);
      expect(res.status).toBe(403);
    });
  });
});
