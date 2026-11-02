import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/server/auth/schemas";

describe("Auth Validation Schemas", () => {
  describe("registerSchema", () => {
    it("should accept valid registration payloads", () => {
      const valid = {
        name: "Dev Executive",
        email: "DEV@company.com",
        password: "securePassword123",
        role: "executive",
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("dev@company.com"); // lowercased
        expect(result.data.role).toBe("executive");
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
