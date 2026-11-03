import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema, createStaffUserSchema } from "@/server/auth/schemas";

describe("Auth Validation Schemas", () => {
  describe("registerSchema (Public Buyer Registration)", () => {
    it("should accept valid registration payloads and ignore role/isAdmin injection", () => {
      const valid = {
        name: "Dev Buyer",
        email: "DEV@company.com",
        password: "securePassword123",
        role: "admin", // attacker attempts privilege escalation
        isAdmin: true,
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("dev@company.com"); // lowercased
        // role and isAdmin must not exist on parsed data
        expect((result.data as Record<string, unknown>).role).toBeUndefined();
        expect((result.data as Record<string, unknown>).isAdmin).toBeUndefined();
      }
    });

    it("should reject passwords shorter than 8 characters", () => {
      const invalid = {
        name: "Dev",
        email: "dev@company.com",
        password: "short",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid email formats", () => {
      const invalid = {
        name: "Dev",
        email: "not-an-email",
        password: "password1234",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("createStaffUserSchema (Admin Staff Provisioning)", () => {
    it("should accept valid staff provisioning payload", () => {
      const valid = {
        name: "Sarah Patel",
        email: "sarah@company.com",
        password: "securePassword123",
        role: "executive",
        isAdmin: false,
      };
      const result = createStaffUserSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("executive");
        expect(result.data.isAdmin).toBe(false);
      }
    });

    it("should reject non-staff roles", () => {
      const invalid = {
        name: "Buyer Impersonator",
        email: "buyer@company.com",
        password: "securePassword123",
        role: "buyer",
      };
      const result = createStaffUserSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should validate and normalize login input", () => {
      const valid = {
        email: "USER@Domain.COM",
        password: "secretPassword",
      };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@domain.com");
      }
    });
  });
});
