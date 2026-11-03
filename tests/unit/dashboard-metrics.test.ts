import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { dashboardService } from "@/server/services/analytics/dashboard";
import { GET as getAdminDashboard } from "@/app/api/admin/dashboard/route";
import { GET as getExecutiveDashboard } from "@/app/api/executive/dashboard/route";
import * as cookiesModule from "@/server/auth/cookies";

vi.mock("@/server/auth/cookies", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Source Dashboard Metrics & RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Pure Metrics Calculations against Fixed Dataset", () => {
    const fixedNow = new Date("2026-11-04T12:00:00.000Z");

    it("correctly counts unique leads and excludes duplicate enquiries from lead volume", async () => {
      // Mock client that returns 3 unique leads and 2 duplicates
      const mockClient = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "lead-1", source: "property_portal", duplicateOfId: null, firstResponseAt: new Date("2026-11-01T10:01:00Z"), createdAt: new Date("2026-11-01T10:00:00Z") },
              { id: "lead-2", source: "website", duplicateOfId: null, firstResponseAt: new Date("2026-11-02T10:03:00Z"), createdAt: new Date("2026-11-02T10:00:00Z") },
              { id: "lead-3", source: "social_media_ad", duplicateOfId: null, firstResponseAt: null, createdAt: new Date("2026-11-03T10:00:00Z") },
              // Duplicates
              { id: "lead-4", source: "social_media_ad", duplicateOfId: "lead-1", firstResponseAt: null, createdAt: new Date("2026-11-02T12:00:00Z") },
              { id: "lead-5", source: "website", duplicateOfId: "lead-2", firstResponseAt: null, createdAt: new Date("2026-11-03T12:00:00Z") },
            ]),
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };

      const res = await dashboardService.getMetrics({
        days: 30,
        now: fixedNow,
        dbOrTx: mockClient as any,
      });

      expect(res.summary.uniqueLeads).toBe(3);
      expect(res.summary.duplicateEnquiries).toBe(2);
      expect(res.summary.totalEnquiries).toBe(5);

      // Verify duplicates are attributed to their own source in bySource
      const socialRow = res.bySource.find((s) => s.source === "social_media_ad");
      expect(socialRow?.uniqueLeads).toBe(1);
      expect(socialRow?.duplicateEnquiries).toBe(1);
    });

    it("calculates median first response time accurately in minutes", async () => {
      // 3 answered leads: latencies = 60s (1m), 180s (3m), 600s (10m) -> median = 3.0m
      const mockClient = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "lead-1", source: "website", duplicateOfId: null, firstResponseAt: new Date("2026-11-01T10:01:00Z"), createdAt: new Date("2026-11-01T10:00:00Z") },
              { id: "lead-2", source: "website", duplicateOfId: null, firstResponseAt: new Date("2026-11-01T10:03:00Z"), createdAt: new Date("2026-11-01T10:00:00Z") },
              { id: "lead-3", source: "website", duplicateOfId: null, firstResponseAt: new Date("2026-11-01T10:10:00Z"), createdAt: new Date("2026-11-01T10:00:00Z") },
            ]),
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };

      const res = await dashboardService.getMetrics({
        days: 30,
        now: fixedNow,
        dbOrTx: mockClient as any,
      });

      expect(res.summary.medianResponseTimeMinutes).toBe(3);
      // 1 of 3 (33.3%) <= 2 min
      expect(res.summary.pctAnsweredWithin2Min).toBe(33.3);
      // 2 of 3 (66.7%) <= 5 min
      expect(res.summary.pctAnsweredWithin5Min).toBe(66.7);
    });

    it("calculates show-up rate = visited / (visited + no_show) and handles zero visits safely", async () => {
      // Zero bookings case
      const mockClientZero = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };

      const resZero = await dashboardService.getMetrics({
        days: 30,
        now: fixedNow,
        dbOrTx: mockClientZero as any,
      });

      expect(resZero.summary.showUpRate).toBeNull();
      expect(resZero.summary.overallCostPerVisitFormatted).toBe("No visits yet");
      expect(resZero.bySource[0].costPerVisitFormatted).toBe("No visits yet");

      // Bookings case: 3 visited, 1 no_show -> showUpRate = 3 / (3 + 1) = 75.0%
      const mockClientVisits = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "lead-1", source: "property_portal", duplicateOfId: null, firstResponseAt: null, createdAt: fixedNow },
            ]),
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                  { id: "b-1", status: "visited", leadId: "l-1", leadSource: "property_portal", startsAt: fixedNow },
                  { id: "b-2", status: "visited", leadId: "l-2", leadSource: "property_portal", startsAt: fixedNow },
                  { id: "b-3", status: "visited", leadId: "l-3", leadSource: "property_portal", startsAt: fixedNow },
                  { id: "b-4", status: "no_show", leadId: "l-4", leadSource: "property_portal", startsAt: fixedNow },
                ]),
              }),
            }),
          }),
        }),
      };

      const resVisits = await dashboardService.getMetrics({
        days: 30,
        now: fixedNow,
        dbOrTx: mockClientVisits as any,
      });

      expect(resVisits.summary.visitsCompleted).toBe(3);
      expect(resVisits.summary.noShows).toBe(1);
      expect(resVisits.summary.showUpRate).toBe(75);
      expect(resVisits.summary.overallCostPerVisitFormatted).toContain("₹");
    });
  });

  describe("Dashboard Access Control & RBAC", () => {
    it("returns 401 Unauthorized when unauthenticated on /api/admin/dashboard", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/admin/dashboard");
      const res = await getAdminDashboard(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 Forbidden when executive attempts to access /api/admin/dashboard", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "exec-1",
        name: "Sales Rep",
        email: "rep@company.com",
        role: "executive",
        isAdmin: false,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/dashboard");
      const res = await getAdminDashboard(req);
      expect(res.status).toBe(403);
    });

    it("returns 403 Forbidden when buyer attempts to access /api/executive/dashboard", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "buyer-1",
        name: "Home Buyer",
        email: "buyer@example.com",
        role: "buyer",
        isAdmin: false,
      });

      const req = new NextRequest("http://localhost:3000/api/executive/dashboard");
      const res = await getExecutiveDashboard(req);
      expect(res.status).toBe(403);
    });

    it("allows executive to view their trimmed personal numbers on /api/executive/dashboard", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "exec-1",
        name: "Rajesh Sharma",
        email: "rajesh@example.com",
        role: "executive",
        isAdmin: false,
      });

      vi.spyOn(dashboardService, "getMetrics").mockResolvedValue({
        timeRange: { days: 30, startDate: "2026-10-05", endDate: "2026-11-04" },
        summary: {
          uniqueLeads: 15,
          duplicateEnquiries: 2,
          totalEnquiries: 17,
          medianResponseTimeMinutes: 1.5,
          pctAnsweredWithin2Min: 85,
          pctAnsweredWithin5Min: 95,
          pctUnreached48h: 2,
          visitsBooked: 8,
          visitsCompleted: 6,
          noShows: 1,
          showUpRate: 85.7,
          leadToVisitRate: 40,
          totalSpend: 0,
          overallCostPerLead: null,
          overallCostPerVisit: null,
          overallCostPerVisitFormatted: "N/A",
          flaggedChatsCount: 0,
          handoffsByReason: {},
        },
        bySource: [],
        charts: { responseTimeTrend: [], costPerVisitBySource: [] },
      });

      const req = new NextRequest("http://localhost:3000/api/executive/dashboard?days=30");
      const res = await getExecutiveDashboard(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.executiveName).toBe("Rajesh Sharma");
      expect(body.summary.uniqueLeads).toBe(15);
    });
  });
});
