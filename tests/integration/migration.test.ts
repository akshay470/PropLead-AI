import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../helpers/db";

describe("Database Migration Verification", () => {
  it("should apply all migrations cleanly from /drizzle to a fresh PostgreSQL database", async () => {
    const pg = new PGlite();

    await applyMigrations(pg);

    // Verify key tables exist
    const tablesRes = await pg.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
    );
    const tableNames = tablesRes.rows.map((r) => r.table_name);

    expect(tableNames).toContain("users");
    expect(tableNames).toContain("projects");
    expect(tableNames).toContain("leads");
    expect(tableNames).toContain("fact_sheet_entries");
    expect(tableNames).toContain("visit_slots");
    expect(tableNames).toContain("bookings");
    expect(tableNames).toContain("reminders");
    expect(tableNames).toContain("conversations");
    expect(tableNames).toContain("messages");
    expect(tableNames).toContain("handoffs");
    expect(tableNames).toContain("message_log");
    expect(tableNames).toContain("ad_spend");
    expect(tableNames).toContain("executive_projects");

    // Verify partial unique index on bookings
    const bookingIdxRes = await pg.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'confirmed_slot_unique_idx';`
    );
    expect(bookingIdxRes.rows.length).toBe(1);
    expect(bookingIdxRes.rows[0].indexdef).toContain("WHERE (status = 'confirmed'::booking_status)");

    // Verify executive slot uniqueness index
    const slotIdxRes = await pg.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'visit_slots' AND indexname = 'executive_slot_start_unique_idx';`
    );
    expect(slotIdxRes.rows.length).toBe(1);

    await pg.close();
  });
});
