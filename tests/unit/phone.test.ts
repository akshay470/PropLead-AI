import { describe, it, expect } from "vitest";
import {
  normalizePhoneToE164,
  isValidPhone,
  formatPhoneDisplay,
  phoneSchema,
  InvalidPhoneNumberError,
} from "@/lib/phone";

describe("Phone Normalization Utility", () => {
  describe("normalizePhoneToE164", () => {
    it("should normalize clean 10-digit Indian numbers", () => {
      expect(normalizePhoneToE164("9876543210")).toBe("+919876543210");
      expect(normalizePhoneToE164("8123456789")).toBe("+918123456789");
      expect(normalizePhoneToE164("7000000000")).toBe("+917000000000");
      expect(normalizePhoneToE164("6999999999")).toBe("+916999999999");
    });

    it("should normalize numbers with leading 0 (trunk prefix)", () => {
      expect(normalizePhoneToE164("09876543210")).toBe("+919876543210");
    });

    it("should normalize numbers with country code prefix 91 or +91", () => {
      expect(normalizePhoneToE164("919876543210")).toBe("+919876543210");
      expect(normalizePhoneToE164("+919876543210")).toBe("+919876543210");
    });

    it("should strip whitespace, dashes, and parentheses", () => {
      expect(normalizePhoneToE164("+91 98765 43210")).toBe("+919876543210");
      expect(normalizePhoneToE164("+91-98765-43210")).toBe("+919876543210");
      expect(normalizePhoneToE164(" (09876) 543-210 ")).toBe("+919876543210");
      expect(normalizePhoneToE164("98765.43210")).toBe("+919876543210");
    });

    it("should throw InvalidPhoneNumberError for invalid phone numbers", () => {
      expect(() => normalizePhoneToE164("")).toThrow(InvalidPhoneNumberError);
      expect(() => normalizePhoneToE164("12345")).toThrow(InvalidPhoneNumberError);
      expect(() => normalizePhoneToE164("5876543210")).toThrow(InvalidPhoneNumberError); // Doesn't start with 6-9
      expect(() => normalizePhoneToE164("abcdefghij")).toThrow(InvalidPhoneNumberError);
    });
  });

  describe("isValidPhone", () => {
    it("should return true for valid formats", () => {
      expect(isValidPhone("9876543210")).toBe(true);
      expect(isValidPhone("+91 98765 43210")).toBe(true);
      expect(isValidPhone("09876543210")).toBe(true);
    });

    it("should return false for invalid formats", () => {
      expect(isValidPhone("123")).toBe(false);
      expect(isValidPhone("invalid")).toBe(false);
      expect(isValidPhone("")).toBe(false);
    });
  });

  describe("formatPhoneDisplay", () => {
    it("should format +91 number with spaces", () => {
      expect(formatPhoneDisplay("+919876543210")).toBe("+91 98765 43210");
    });

    it("should leave non-standard strings untouched", () => {
      expect(formatPhoneDisplay("+14155552671")).toBe("+14155552671");
    });
  });

  describe("phoneSchema (Zod transformer)", () => {
    it("should parse and transform raw inputs", () => {
      const parsed = phoneSchema.safeParse("98765 43210");
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe("+919876543210");
      }
    });

    it("should fail validation on invalid inputs", () => {
      const parsed = phoneSchema.safeParse("1234");
      expect(parsed.success).toBe(false);
    });
  });
});
