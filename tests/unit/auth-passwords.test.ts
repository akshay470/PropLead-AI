import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/passwords";

describe("Password Hashing & Verification", () => {
  it("should hash passwords securely and verify matching plaintext", async () => {
    const password = "SecurePassword123!";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);
  });

  it("should reject mismatched passwords", async () => {
    const password = "CorrectPassword123";
    const wrongPassword = "WrongPassword123";
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(wrongPassword, hash);
    expect(isMatch).toBe(false);
  });

  it("should handle empty or null values gracefully", async () => {
    expect(await verifyPassword("", "$2a$10$abcdef")).toBe(false);
    expect(await verifyPassword("password", "")).toBe(false);
  });
});
