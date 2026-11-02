import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

describe("Database Migration Verification", () => {
  it("should apply the full initial migration cleanly to a fresh PostgreSQL database", async () => {
    const pg = new PGlite();

    const migrationPath = path.resolve(__dirname, "../../drizzle/0000_luxuriant_agent_zero.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    // Split statements by drizzle-kit statement breakpoint
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    expect(statements.length).toBeGreaterThan(10);

    for (const statement of statements) {
      await pg.exec(statement);
    }

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

    // Verify partial unique index on bookings
    const indexRes = await pg.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bookings' AND indexname = 'confirmed_slot_unique_idx';`
    );
    expect(indexRes.rows.length).toBe(1);
    expect(indexRes.rows[0].indexdef).toContain("WHERE (status = 'confirmed'::booking_status)");

    await pg.close();
  });
});
