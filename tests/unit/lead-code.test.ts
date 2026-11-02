import { describe, it, expect } from "vitest";
import { generateLeadCode } from "@/server/services/lead-service";

describe("Lead Code Generator", () => {
  it("should generate codes matching the format LD-XXXXX", () => {
    const code = generateLeadCode();
    expect(code).toMatch(/^LD-\d{5}$/);
  });

  it("should generate random unique codes", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateLeadCode()));
    expect(codes.size).toBeGreaterThan(45); // highly improbable to have more than 5 duplicates in 50
  });
});
