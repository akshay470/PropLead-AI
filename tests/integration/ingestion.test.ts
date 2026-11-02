import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import * as fs from "fs";
import * as path from "path";
import { createLeadFromEnquiry, setFirstResponseAt } from "@/server/services/leads/ingestion";

describe("Lead Ingestion Service (Integration)", () => {
  let pg: PGlite;
  let testDb: any;
  let testProjectId: string;

  beforeAll(async () => {
    pg = new PGlite();
    testDb = drizzle(pg, { schema });

    // Run initial migration
    const migrationPath = path.resolve(__dirname, "../../drizzle/0000_luxuriant_agent_zero.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await pg.exec(statement);
    }

    // Insert dummy project
    const [p] = await testDb
      .insert(schema.projects)
      .values({
        name: "Project 1",
        reraNumber: "PR/GJ/AHMEDABAD/TEST-0001",
        locationName: "Bodakdev",
        lat: "23.0338",
        lng: "72.5072",
        address: "SG Highway, Bodakdev, Ahmedabad",
      })
      .returning();

    testProjectId = p.id;
  });

  afterAll(async () => {
    await pg.close();
  });

  it("should ingest a fresh lead with sequential lead_code and normalized phone", async () => {
    const result = await createLeadFromEnquiry(
      {
        name: "Aarav Sharma",
        phone: "98251 12345",
        email: "AARAV@Example.COM",
        source: "property_portal",
        projectId: testProjectId,
        wants: "3BHK",
        consentGiven: true,
      },
      testDb
    );

    expect(result.lead).toBeDefined();
    expect(result.lead.phoneE164).toBe("+919825112345");
    expect(result.lead.email).toBe("aarav@example.com");
    expect(result.lead.leadCode).toBe("LD-58201");
    expect(result.isDuplicate).toBe(false);
    expect(result.lead.duplicateOfId).toBeNull();
  });

  it("should automatically link a duplicate enquiry to the canonical lead while preserving candidate source", async () => {
    // Second enquiry with the same phone in a different format ("09825112345") from social media
    const result = await createLeadFromEnquiry(
      {
        name: "Aarav Sharma",
        phone: "09825112345", // Leading 0 format
        email: "aarav.work@example.com",
        source: "social_media_ad",
        projectId: testProjectId,
        wants: "2BHK",
        consentGiven: true,
      },
      testDb
    );

    expect(result.lead).toBeDefined();
    expect(result.isDuplicate).toBe(true);
    expect(result.canonicalLead).toBeDefined();
    expect(result.lead.duplicateOfId).toBe(result.canonicalLead?.id);
    expect(result.lead.source).toBe("social_media_ad"); // Original candidate source preserved!
    expect(result.lead.leadCode).toBe("LD-58202"); // Next sequential code!
  });

  it("should record first_response_at only on the initial response", async () => {
    const { lead } = await createLeadFromEnquiry(
      {
        name: "Diya Parikh",
        phone: "9825222222",
        source: "website",
        projectId: testProjectId,
        consentGiven: true,
      },
      testDb
    );

    expect(lead.firstResponseAt).toBeNull();

    const timestamp1 = new Date("2026-11-03T01:00:00Z");
    const updatedFirst = await setFirstResponseAt(lead.id, timestamp1, testDb);
    expect(updatedFirst).toBe(true);

    // Verify it was saved
    const [fetched] = await testDb
      .select({ firstResponseAt: schema.leads.firstResponseAt })
      .from(schema.leads)
      .where(eq(schema.leads.id, lead.id));
    expect(new Date(fetched.firstResponseAt).toISOString()).toBe(timestamp1.toISOString());

    // Subsequent response should not overwrite the first response timestamp
    const timestamp2 = new Date("2026-11-03T02:00:00Z");
    const updatedSecond = await setFirstResponseAt(lead.id, timestamp2, testDb);
    expect(updatedSecond).toBe(false);
  });
});
