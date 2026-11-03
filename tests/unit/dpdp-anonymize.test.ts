import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as postAnonymize } from "@/app/api/admin/leads/[id]/anonymize/route";
import * as cookiesModule from "@/server/auth/cookies";
import * as leadsServiceModule from "@/server/services/leads";

vi.mock("@/server/auth/cookies", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/server/services/leads", () => ({
  anonymizeLead: vi.fn(),
}));

describe("DPDP Act 2023 - Lead Anonymization (/api/admin/leads/[id]/anonymize)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 Unauthorized when unauthenticated", async () => {
    vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/admin/leads/lead-123/anonymize", {
      method: "POST",
    });
    const res = await postAnonymize(req, { params: Promise.resolve({ id: "lead-123" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 Forbidden when authenticated as executive", async () => {
    vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
      id: "exec-1",
      email: "exec@company.com",
      name: "Exec User",
      role: "executive",
      isAdmin: false,
    });

    const req = new NextRequest("http://localhost:3000/api/admin/leads/lead-123/anonymize", {
      method: "POST",
    });
    const res = await postAnonymize(req, { params: Promise.resolve({ id: "lead-123" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when lead is not found", async () => {
    vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@company.com",
      name: "Admin Head",
      role: "admin",
      isAdmin: true,
    });
    vi.mocked(leadsServiceModule.anonymizeLead).mockResolvedValue({
      success: false,
      error: "Lead not found",
    });

    const req = new NextRequest("http://localhost:3000/api/admin/leads/lead-missing/anonymize", {
      method: "POST",
    });
    const res = await postAnonymize(req, { params: Promise.resolve({ id: "lead-missing" }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Lead not found");
  });

  it("successfully anonymizes lead when invoked by Admin", async () => {
    vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@company.com",
      name: "Admin Head",
      role: "admin",
      isAdmin: true,
    });
    vi.mocked(leadsServiceModule.anonymizeLead).mockResolvedValue({
      success: true,
      leadId: "lead-123",
    });

    const req = new NextRequest("http://localhost:3000/api/admin/leads/lead-123/anonymize", {
      method: "POST",
    });
    const res = await postAnonymize(req, { params: Promise.resolve({ id: "lead-123" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain("anonymized");
    expect(leadsServiceModule.anonymizeLead).toHaveBeenCalledWith("lead-123");
  });
});
