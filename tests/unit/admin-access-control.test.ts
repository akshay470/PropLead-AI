import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getAdminReview } from "@/app/api/admin/review/route";
import { GET as getAdminFacts, POST as postAdminFacts } from "@/app/api/admin/facts/route";
import { PATCH as patchHandoff } from "@/app/api/executive/handoffs/[id]/route";
import * as cookiesModule from "@/server/auth/cookies";
import { db } from "@/server/db";

let mockDbState: {
  selectResults?: any[];
  returningResults?: any[];
} = {};

vi.mock("@/server/auth/cookies", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/server/db", () => {
  const createChainable = () => {
    const chain: any = {
      select: vi.fn(() => chain),
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve(mockDbState.selectResults || [])),
      insert: vi.fn(() => chain),
      values: vi.fn(() => chain),
      returning: vi.fn(() => Promise.resolve(mockDbState.returningResults || [])),
      update: vi.fn(() => chain),
      set: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      then: (resolve: any) => Promise.resolve(mockDbState.selectResults || []).then(resolve),
      catch: (reject: any) => Promise.resolve(mockDbState.selectResults || []).catch(reject),
    };
    return chain;
  };

  const mockDb = createChainable();
  return { db: mockDb };
});

describe("Admin & Executive RBAC, Fact Compliance, and Handoff Status Transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbState = {
      selectResults: [],
      returningResults: [],
    };
  });

  describe("Admin Review Queue Access Control (/api/admin/review)", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/admin/review");
      const res = await getAdminReview(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Unauthorized");
    });

    it("returns 403 Forbidden when accessed by a sales executive", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "exec-1",
        name: "Sales Rep",
        email: "rep@company.com",
        role: "executive",
        isAdmin: false,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/review");
      const res = await getAdminReview(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Forbidden");
    });

    it("returns 403 Forbidden when accessed by a buyer", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "buyer-1",
        name: "Home Buyer",
        email: "buyer@example.com",
        role: "buyer",
        isAdmin: false,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/review");
      const res = await getAdminReview(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Forbidden");
    });

    it("allows access for admin role", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "admin-1",
        name: "Sales Head",
        email: "head@company.com",
        role: "admin",
        isAdmin: true,
      });

      mockDbState.selectResults = [];

      const req = new NextRequest("http://localhost:3000/api/admin/review?status=pending");
      const res = await getAdminReview(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.conversations).toBeDefined();
      expect(body.digest).toBeDefined();
      expect(body.digest.pendingReview).toBe(0);
    });
  });

  describe("Admin Fact Sheet Access Control & Compliance (/api/admin/facts)", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/admin/facts");
      const res = await getAdminFacts(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Unauthorized");
    });

    it("returns 403 Forbidden when accessed by an executive", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "exec-1",
        name: "Sales Rep",
        email: "rep@company.com",
        role: "executive",
        isAdmin: false,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/facts");
      const res = await getAdminFacts(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Forbidden");
    });

    it("rejects fact creation with single-figure price claim", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "admin-1",
        name: "Sales Head",
        email: "head@company.com",
        role: "admin",
        isAdmin: true,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/facts", {
        method: "POST",
        body: JSON.stringify({
          projectId: "a0000000-0000-0000-0000-000000000001",
          category: "pricing_and_unit_types",
          questionKey: "2bhk_exact_price",
          answerText: "The 2 BHK apartment is priced at Rs 70 Lakh flat.",
        }),
      });

      const res = await postAdminFacts(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Compliance Violation");
      expect(body.reason).toBe("single_figure_price_claim");
      expect(body.violatingSnippet).toBeDefined();
    });

    it("rejects fact creation with unauthorized cash discounts", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "admin-1",
        name: "Sales Head",
        email: "head@company.com",
        role: "admin",
        isAdmin: true,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/facts", {
        method: "POST",
        body: JSON.stringify({
          projectId: "a0000000-0000-0000-0000-000000000001",
          category: "pricing_and_unit_types",
          questionKey: "festive_discount",
          answerText: "Special Diwali cash discount of Rs 5 Lakh available for spot bookings.",
        }),
      });

      const res = await postAdminFacts(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.reason).toBe("discount_or_exact_price_promise");
    });

    it("accepts compliant price-range fact entry", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "admin-1",
        name: "Sales Head",
        email: "head@company.com",
        role: "admin",
        isAdmin: true,
      });

      const fakeEntry = {
        id: "fact-new-1",
        projectId: "a0000000-0000-0000-0000-000000000001",
        category: "pricing_and_unit_types",
        questionKey: "2bhk_price_range",
        answerText: "2 BHK homes range from Rs 65 Lakh to Rs 76 Lakh depending on floor selection.",
        updatedAt: new Date(),
      };

      mockDbState.returningResults = [fakeEntry];

      const req = new NextRequest("http://localhost:3000/api/admin/facts", {
        method: "POST",
        body: JSON.stringify({
          projectId: fakeEntry.projectId,
          category: fakeEntry.category,
          questionKey: fakeEntry.questionKey,
          answerText: fakeEntry.answerText,
        }),
      });

      const res = await postAdminFacts(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.fact).toBeDefined();
    });
  });

  describe("Handoff Status Transitions (/api/executive/handoffs/[id])", () => {
    it("returns 403 if executive attempts to update a handoff assigned to another executive", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "exec-1",
        name: "Executive One",
        email: "exec1@company.com",
        role: "executive",
        isAdmin: false,
      });

      mockDbState.selectResults = [
        {
          id: "handoff-100",
          executiveId: "exec-2", // different executive
          leadId: "lead-1",
          status: "open",
          notes: null,
        },
      ];

      const req = new NextRequest("http://localhost:3000/api/executive/handoffs/handoff-100", {
        method: "PATCH",
        body: JSON.stringify({ status: "contacted", notes: "Tried calling" }),
      });

      const res = await patchHandoff(req, { params: { id: "handoff-100" } });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Forbidden");
    });

    it("allows assigned executive to transition status from open -> contacted", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "exec-1",
        name: "Executive One",
        email: "exec1@company.com",
        role: "executive",
        isAdmin: false,
      });

      mockDbState.selectResults = [
        {
          id: "handoff-100",
          executiveId: "exec-1",
          leadId: "lead-1",
          status: "open",
          notes: null,
        },
      ];

      const updatedRecord = {
        id: "handoff-100",
        executiveId: "exec-1",
        leadId: "lead-1",
        status: "contacted",
        notes: "Buyer contacted via WhatsApp",
        resolvedAt: null,
      };

      mockDbState.returningResults = [updatedRecord];

      const req = new NextRequest("http://localhost:3000/api/executive/handoffs/handoff-100", {
        method: "PATCH",
        body: JSON.stringify({ status: "contacted", notes: "Buyer contacted via WhatsApp" }),
      });

      const res = await patchHandoff(req, { params: { id: "handoff-100" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.handoff.status).toBe("contacted");
    });

    it("allows admin to resolve any executive handoff", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "admin-1",
        name: "Sales Head",
        email: "head@company.com",
        role: "admin",
        isAdmin: true,
      });

      mockDbState.selectResults = [
        {
          id: "handoff-200",
          executiveId: "exec-2",
          leadId: "lead-2",
          status: "contacted",
          notes: "Buyer visited site",
        },
      ];

      const resolvedRecord = {
        id: "handoff-200",
        executiveId: "exec-2",
        leadId: "lead-2",
        status: "resolved",
        notes: "Buyer completed site visit and booking advance paid",
        resolvedAt: new Date(),
      };

      mockDbState.returningResults = [resolvedRecord];

      const req = new NextRequest("http://localhost:3000/api/executive/handoffs/handoff-200", {
        method: "PATCH",
        body: JSON.stringify({
          status: "resolved",
          notes: "Buyer completed site visit and booking advance paid",
        }),
      });

      const res = await patchHandoff(req, { params: { id: "handoff-200" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.handoff.status).toBe("resolved");
    });
  });
});
