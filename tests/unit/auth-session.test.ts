import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  SessionUser,
} from "@/server/auth/session";

describe("Session Token (JWT)", () => {
  const mockUser: SessionUser = {
    userId: "123e4567-e89b-12d3-a456-426614174000",
    name: "Akshay Sales Head",
    email: "akshay@example.com",
    role: "admin",
    isAdmin: true,
  };

  it("should generate a valid JWT and decrypt into session user", async () => {
    const token = await createSessionToken(mockUser);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(mockUser.userId);
    expect(decoded?.email).toBe(mockUser.email);
    expect(decoded?.role).toBe("admin");
    expect(decoded?.isAdmin).toBe(true);
  });

  it("should return null for tampered or invalid tokens", async () => {
    const token = await createSessionToken(mockUser);
    const tampered = token.slice(0, -6) + "abcdef";

    const decoded = await verifySessionToken(tampered);
    expect(decoded).toBeNull();
  });

  it("should return null for empty tokens", async () => {
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("not-a-token")).toBeNull();
  });
});
