import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/leads/route";
import * as cookiesModule from "@/server/auth/cookies";
import { leadService } from "@/server/services/leads";

vi.mock("@/server/auth/cookies", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/server/services/leads", () => ({
  leadService: {
    getLeads: vi.fn().mockResolvedValue({ leads: [], totalCount: 0, limit: 50, offset: 0 }),
    createLeadFromEnquiry: vi.fn(),
  },
}));

describe("Leads API Authorization & Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 Unauthorized if no session exists", async () => {
    vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/leads");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 403 Forbidden if user has 'buyer' role", async () => {
    vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
      userId: "buyer-123",
      name: "Demo Buyer",
      email: "buyer@example.com",
      role: "buyer",
      isAdmin: false,
    });

    const req = new NextRequest("http://localhost:3000/api/leads");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Forbidden");
  });

  it("should allow 'executive' role to retrieve leads", async () => {
    vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
      userId: "exec-123",
      name: "Sales Executive",
      email: "exec@company.com",
      role: "executive",
      isAdmin: false,
    });

    const req = new NextRequest("http://localhost:3000/api/leads");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(leadService.getLeads).toHaveBeenCalled();
  });

  it("should allow 'admin' role to retrieve leads", async () => {
    vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
      userId: "admin-123",
      name: "Sales Head",
      email: "admin@company.com",
      role: "admin",
      isAdmin: true,
    });

    const req = new NextRequest("http://localhost:3000/api/leads");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(leadService.getLeads).toHaveBeenCalled();
  });
});
