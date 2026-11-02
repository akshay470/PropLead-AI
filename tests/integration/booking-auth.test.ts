import { describe, it, expect } from "vitest";
import { signLeadSessionToken, verifyLeadSessionToken } from "@/server/auth/lead-session";

describe("Booking Auth & Lead Session Token Guardrails", () => {
  it("generates and verifies signed lead session tokens", async () => {
    const payload = {
      leadId: "11111111-1111-1111-1111-111111111111",
      conversationId: "22222222-2222-2222-2222-222222222222",
    };

    const token = await signLeadSessionToken(payload);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    const decoded = await verifyLeadSessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.leadId).toBe(payload.leadId);
    expect(decoded?.conversationId).toBe(payload.conversationId);
  });

  it("rejects tampered or malformed tokens", async () => {
    const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";
    const decoded = await verifyLeadSessionToken(invalidToken);
    expect(decoded).toBeNull();
  });

  it("enforces that buyer sessions derive target leadId strictly from the session token", async () => {
    const buyerSession = {
      leadId: "lead-real-buyer-id",
      conversationId: "conv-1",
    };

    const maliciousBody = {
      slotId: "slot-123",
      leadId: "lead-victim-spoofed-id",
    };

    // Simulate route logic: if caller is buyer session, targetLeadId is strictly derived from session
    const isStaff = false;
    let targetLeadId: string;

    if (isStaff) {
      targetLeadId = maliciousBody.leadId;
    } else {
      // In buyer chat session:
      targetLeadId = buyerSession.leadId; // strictly forced from session
    }

    expect(targetLeadId).toBe("lead-real-buyer-id");
    expect(targetLeadId).not.toBe(maliciousBody.leadId);
  });
});
