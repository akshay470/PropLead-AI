import { describe, it, expect } from "vitest";
import { findDuplicate, DedupeLeadRecord } from "@/server/services/leads/deduplication";

describe("Duplicate Detection (findDuplicate)", () => {
  const baseCanonicalLead: DedupeLeadRecord = {
    id: "lead-canonical-1",
    leadCode: "LD-50001",
    name: "Hardik Patel",
    phoneE164: "+919825012345",
    email: "hardik@example.com",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    duplicateOfId: null,
    optedOut: false,
  };

  it("should match same phone across 4 common Indian formats", () => {
    const existingLeads = [baseCanonicalLead];
    const phoneFormats = [
      "+91 98250 12345",
      "09825012345",
      "9825012345",
      "+919825012345",
    ];

    for (const phone of phoneFormats) {
      const result = findDuplicate({ phone }, existingLeads);
      expect(result.isDuplicate).toBe(true);
      expect(result.canonicalLead?.id).toBe("lead-canonical-1");
      expect(result.canonicalLead?.leadCode).toBe("LD-50001");
      expect(result.matchedBy).toBe("phone");
    }
  });

  it("should match same email with different casing", () => {
    const existingLeads = [baseCanonicalLead];
    const candidate = {
      phone: "+919999999999", // Different phone
      email: "HARDIK@Example.COM", // Same email, uppercase
    };

    const result = findDuplicate(candidate, existingLeads);
    expect(result.isDuplicate).toBe(true);
    expect(result.canonicalLead?.id).toBe("lead-canonical-1");
    expect(result.matchedBy).toBe("email");
  });

  it("should NOT flag different phone with the same name as a duplicate", () => {
    const existingLeads = [baseCanonicalLead];
    const candidate = {
      name: "Hardik Patel", // Same common name
      phone: "+919898011223", // Completely different phone
      email: "hardik.different@otherdomain.com",
    };

    const result = findDuplicate(candidate, existingLeads);
    expect(result.isDuplicate).toBe(false);
    expect(result.canonicalLead).toBeNull();
  });

  it("should resolve a three-way duplicate chain to the oldest root lead", () => {
    const leadOldest: DedupeLeadRecord = {
      id: "lead-oldest",
      leadCode: "LD-10001",
      name: "Nidhi Shah",
      phoneE164: "+919825099999",
      email: "nidhi@example.com",
      createdAt: new Date("2026-01-01T08:00:00Z"),
      duplicateOfId: null,
    };

    const leadSecond: DedupeLeadRecord = {
      id: "lead-second",
      leadCode: "LD-10002",
      name: "Nidhi Shah",
      phoneE164: "+919825099999",
      email: "nidhi.shah@work.example.com",
      createdAt: new Date("2026-01-05T08:00:00Z"),
      duplicateOfId: "lead-oldest",
    };

    const existingLeads = [leadSecond, leadOldest];

    // New candidate arrives matching leadSecond by secondary work email
    const candidate = {
      phone: "+919825000000",
      email: "nidhi.shah@work.example.com",
      createdAt: new Date("2026-01-10T08:00:00Z"),
    };

    const result = findDuplicate(candidate, existingLeads);
    expect(result.isDuplicate).toBe(true);
    // Even though it matched leadSecond directly, it resolves back to the root oldest lead
    expect(result.canonicalLead?.id).toBe("lead-oldest");
    expect(result.canonicalLead?.leadCode).toBe("LD-10001");
  });

  it("should ensure an opted-out lead retains opted-out status after duplicate linking", () => {
    const optedOutLead: DedupeLeadRecord = {
      id: "lead-opted-out",
      leadCode: "LD-20001",
      name: "Kavita Joshi",
      phoneE164: "+919825055555",
      email: "kavita@example.com",
      createdAt: new Date("2026-01-01T12:00:00Z"),
      duplicateOfId: null,
      optedOut: true, // Lead opted out previously
    };

    const candidate = {
      phone: "09825055555",
      name: "Kavita Joshi",
      email: "kavita@example.com",
      optedOut: false,
    };

    const result = findDuplicate(candidate, [optedOutLead]);
    expect(result.isDuplicate).toBe(true);
    expect(result.canonicalLead?.optedOut).toBe(true);
  });
});
