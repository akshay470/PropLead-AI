import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import * as fs from "fs";
import * as path from "path";
import { hashPassword } from "@/server/auth/passwords";
import { findDuplicate } from "@/server/services/leads/deduplication";
import { eq } from "drizzle-orm";

describe("Seed Script Logic & Data Integrity", () => {
  let pg: PGlite;
  let testDb: any;

  beforeAll(async () => {
    pg = new PGlite();
    testDb = drizzle(pg, { schema });

    // Run migration
    const migrationPath = path.resolve(__dirname, "../../drizzle/0000_luxuriant_agent_zero.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await pg.exec(statement);
    }
  });

  afterAll(async () => {
    await pg.close();
  });

  it("should create projects, users, exact sample leads, and duplicates", async () => {
    const passwordHash = await hashPassword("DemoPass123!");

    // Insert Admin & Executives
    const [admin] = await testDb
      .insert(schema.users)
      .values({
        name: "Vikram Mehta",
        email: "admin@example.com",
        passwordHash,
        role: "admin",
        isAdmin: true,
      })
      .returning();

    const [exec1] = await testDb
      .insert(schema.users)
      .values({
        name: "Rajesh Sharma",
        email: "rajesh@example.com",
        passwordHash,
        role: "executive",
      })
      .returning();

    // Insert Projects
    const [p1, p2] = await testDb
      .insert(schema.projects)
      .values([
        {
          name: "Project 1",
          reraNumber: "PR/GJ/AHMEDABAD/DEMO-0001",
          locationName: "Bodakdev",
          lat: "23.0338",
          lng: "72.5072",
          address: "SG Highway, Bodakdev",
        },
        {
          name: "Project 2",
          reraNumber: "PR/GJ/AHMEDABAD/DEMO-0002",
          locationName: "Shela",
          lat: "23.0125",
          lng: "72.4589",
          address: "Club O7 Road, Shela",
        },
      ])
      .returning();

    // Insert exact sample lead 1: LD-58210 Hardik Patel
    const [hardik] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-58210",
        name: "Hardik Patel",
        phoneE164: "+919825012345",
        email: "hardik.patel@example.com",
        source: "property_portal",
        projectId: p1.id,
        wants: "3BHK",
        status: "visit_scheduled",
        consentGiven: true,
      })
      .returning();

    // Insert exact sample lead 2: LD-58211 Nidhi Shah
    const [nidhi] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-58211",
        name: "Nidhi Shah",
        phoneE164: "+919825098765",
        email: "nidhi.shah@example.com",
        source: "social_media_ad",
        projectId: p2.id,
        wants: "2BHK",
        status: "qualified",
        consentGiven: true,
      })
      .returning();

    // Insert exact sample lead 3: LD-58224 Kavita Joshi
    const [kavita] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-58224",
        name: "Kavita Joshi",
        phoneE164: "+919825044444",
        email: "kavita.joshi@example.com",
        source: "hoarding_call",
        projectId: p2.id,
        wants: "2BHK",
        status: "visited",
        consentGiven: true,
      })
      .returning();

    expect(hardik.leadCode).toBe("LD-58210");
    expect(hardik.status).toBe("visit_scheduled");
    expect(nidhi.leadCode).toBe("LD-58211");
    expect(kavita.leadCode).toBe("LD-58224");

    // Process duplicate for Hardik Patel with leading 0 phone
    const dedupeCheck = findDuplicate(
      { phone: "09825012345", email: "hardik.patel@example.com" },
      [hardik, nidhi, kavita]
    );

    expect(dedupeCheck.isDuplicate).toBe(true);
    expect(dedupeCheck.canonicalLead?.id).toBe(hardik.id);

    // Insert duplicate lead with link to Hardik
    const [hardikDup] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-58225",
        name: "Hardik Patel",
        phoneE164: "+919825012345",
        source: "social_media_ad", // preserved source
        projectId: p1.id,
        duplicateOfId: dedupeCheck.canonicalLead?.id,
        consentGiven: true,
      })
      .returning();

    expect(hardikDup.duplicateOfId).toBe(hardik.id);
  });
});
