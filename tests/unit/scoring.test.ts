import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeLeadScore, recomputeLeadScore } from "@/server/services/scoring";
import { NextRequest } from "next/server";
import { GET as getLeadDetail } from "@/app/api/leads/[id]/route";
import { GET as getLeadsList } from "@/app/api/leads/route";
import * as cookiesModule from "@/server/auth/cookies";
import { handoffService } from "@/server/services/handoff";

vi.mock("@/server/auth/cookies", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/server/services/handoff", () => ({
  handoffService: {
    createHandoff: vi.fn().mockResolvedValue({ id: "h-test" }),
  },
}));

vi.mock("@/server/services/leads", () => ({
  leadService: {
    getLeads: vi.fn().mockResolvedValue({
      leads: [
        {
          id: "lead-1",
          assignedExecutiveId: "exec-1",
          scoreTotal: 85,
          scoreTier: "hot",
          scoreBreakdown: {},
          scoreDataCompleteness: "complete",
          scoreComputedAt: new Date().toISOString(),
        },
        {
          id: "lead-2",
          assignedExecutiveId: "exec-2",
          scoreTotal: 65,
          scoreTier: "warm",
          scoreBreakdown: {},
          scoreDataCompleteness: "complete",
          scoreComputedAt: new Date().toISOString(),
        },
      ],
      totalCount: 2,
      limit: 50,
      offset: 0,
    }),
    createLeadFromEnquiry: vi.fn(),
  },
}));

describe("Lead Priority Score Engine & Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Pure computeLeadScore Parameter Boundaries", () => {
    // 1. Budget parameter (Max 25 pts)
    describe("Budget Parameter (Max 25)", () => {
      it("awards 25 pts when budget matches project price range", () => {
        const res = computeLeadScore({
          budgetMin: 7000000,
          budgetMax: 7500000,
          projectMinPrice: 6500000,
          projectMaxPrice: 7600000,
        });
        expect(res.breakdown.budget.points).toBe(25);
        expect(res.breakdown.budget.maxPoints).toBe(25);
        expect(res.breakdown.missing).not.toContain("budget");
      });

      it("awards 25 pts when budget comfortably covers luxury range (>1.3x max)", () => {
        const res = computeLeadScore({
          budgetMin: 15000000,
          budgetMax: 18000000,
          projectMinPrice: 6500000,
          projectMaxPrice: 7600000,
        });
        expect(res.breakdown.budget.points).toBe(25);
        expect(res.breakdown.budget.reason).toContain("luxury");
      });

      it("awards 16 pts when budget is slightly below entry point (>=85% min)", () => {
        // min 65L, 85% is 55.25L. Budget 60L -> 16 pts
        const res = computeLeadScore({
          budgetMax: 6000000,
          projectMinPrice: 6500000,
          projectMaxPrice: 7600000,
        });
        expect(res.breakdown.budget.points).toBe(16);
      });

      it("awards 8 pts when budget is moderately below entry point (>=70% min)", () => {
        // min 65L, 70% is 45.5L. Budget 50L -> 8 pts
        const res = computeLeadScore({
          budgetMax: 5000000,
          projectMinPrice: 6500000,
          projectMaxPrice: 7600000,
        });
        expect(res.breakdown.budget.points).toBe(8);
      });

      it("awards 4 pts when budget is substantially below entry point (<70% min)", () => {
        // min 65L, 40L is < 45.5L -> 4 pts
        const res = computeLeadScore({
          budgetMax: 4000000,
          projectMinPrice: 6500000,
          projectMaxPrice: 7600000,
        });
        expect(res.breakdown.budget.points).toBe(4);
      });

      it("awards neutral 8 pts and records missing when budget is missing/zero", () => {
        const res = computeLeadScore({
          budgetMin: null,
          budgetMax: null,
        });
        expect(res.breakdown.budget.points).toBe(8);
        expect(res.breakdown.missing).toContain("budget");
      });
    });

    // 2. Buying Timeline parameter (Max 25 pts)
    describe("Timeline Parameter (Max 25)", () => {
      it("awards 25 pts for 'within_1_month'", () => {
        const res = computeLeadScore({ buyingTimeline: "within_1_month" });
        expect(res.breakdown.timeline.points).toBe(25);
        expect(res.breakdown.missing).not.toContain("timeline");
      });

      it("awards 20 pts for '1_to_3_months'", () => {
        const res = computeLeadScore({ buyingTimeline: "1_to_3_months" });
        expect(res.breakdown.timeline.points).toBe(20);
      });

      it("awards 12 pts for '3_to_6_months'", () => {
        const res = computeLeadScore({ buyingTimeline: "3_to_6_months" });
        expect(res.breakdown.timeline.points).toBe(12);
      });

      it("awards 6 pts for 'exploring'", () => {
        const res = computeLeadScore({ buyingTimeline: "exploring" });
        expect(res.breakdown.timeline.points).toBe(6);
      });

      it("awards neutral 8 pts and records missing for 'unknown' or missing timeline", () => {
        const res1 = computeLeadScore({ buyingTimeline: "unknown" });
        expect(res1.breakdown.timeline.points).toBe(8);
        expect(res1.breakdown.missing).toContain("timeline");

        const res2 = computeLeadScore({ buyingTimeline: null });
        expect(res2.breakdown.timeline.points).toBe(8);
        expect(res2.breakdown.missing).toContain("timeline");
      });
    });

    // 3. Site Visit parameter (Max 20 pts)
    describe("Site Visit Parameter (Max 20)", () => {
      it("awards 20 pts for completed visit (hasVisited: true)", () => {
        const res = computeLeadScore({ hasVisited: true });
        expect(res.breakdown.siteVisit.points).toBe(20);
        expect(res.breakdown.missing).not.toContain("siteVisit");
      });

      it("awards 16 pts for confirmed upcoming booking (hasConfirmedBooking: true)", () => {
        const res = computeLeadScore({ hasConfirmedBooking: true });
        expect(res.breakdown.siteVisit.points).toBe(16);
      });

      it("awards 12 pts for rescheduled booking (hasRescheduledBooking: true)", () => {
        const res = computeLeadScore({ hasRescheduledBooking: true });
        expect(res.breakdown.siteVisit.points).toBe(12);
      });

      it("awards 4 pts for cancelled booking or no-show", () => {
        const resCancel = computeLeadScore({ hasCancelledBooking: true });
        expect(resCancel.breakdown.siteVisit.points).toBe(4);

        const resNoShow = computeLeadScore({ hasNoShow: true });
        expect(resNoShow.breakdown.siteVisit.points).toBe(4);
      });

      it("awards neutral 4 pts and records missing when no visit or booking exists", () => {
        const res = computeLeadScore({});
        expect(res.breakdown.siteVisit.points).toBe(4);
        expect(res.breakdown.missing).toContain("siteVisit");
      });
    });

    // 4. Preference parameter (Max 15 pts)
    describe("Preference Parameter (Max 15)", () => {
      it("awards 15 pts for specific BHK/penthouse configuration", () => {
        expect(computeLeadScore({ wants: "2 BHK" }).breakdown.preference.points).toBe(15);
        expect(computeLeadScore({ wants: "3BHK" }).breakdown.preference.points).toBe(15);
        expect(computeLeadScore({ wants: "4BHK luxury" }).breakdown.preference.points).toBe(15);
        expect(computeLeadScore({ wants: "Penthouse" }).breakdown.preference.points).toBe(15);
      });

      it("awards 8 pts for general residential query (apartment/flat/home)", () => {
        expect(computeLeadScore({ wants: "looking for an apartment" }).breakdown.preference.points).toBe(8);
        expect(computeLeadScore({ wants: "flat" }).breakdown.preference.points).toBe(8);
      });

      it("awards 6 pts for other arbitrary preference text", () => {
        expect(computeLeadScore({ wants: "interested in property" }).breakdown.preference.points).toBe(6);
      });

      it("awards neutral 4 pts and records missing when preference is blank", () => {
        const res = computeLeadScore({ wants: "" });
        expect(res.breakdown.preference.points).toBe(4);
        expect(res.breakdown.missing).toContain("preference");
      });
    });

    // 5. Engagement parameter (Max 15 pts)
    describe("Engagement Parameter (Max 15)", () => {
      it("awards 15 pts for 6+ messages", () => {
        expect(computeLeadScore({ messageCount: 6 }).breakdown.engagement.points).toBe(15);
        expect(computeLeadScore({ messageCount: 12 }).breakdown.engagement.points).toBe(15);
      });

      it("awards 10 pts for 3-5 messages", () => {
        expect(computeLeadScore({ messageCount: 3 }).breakdown.engagement.points).toBe(10);
        expect(computeLeadScore({ messageCount: 5 }).breakdown.engagement.points).toBe(10);
      });

      it("awards 6 pts for 1-2 messages", () => {
        expect(computeLeadScore({ messageCount: 1 }).breakdown.engagement.points).toBe(6);
        expect(computeLeadScore({ messageCount: 2 }).breakdown.engagement.points).toBe(6);
      });

      it("awards neutral 3 pts and records missing for 0 messages", () => {
        const res = computeLeadScore({ messageCount: 0 });
        expect(res.breakdown.engagement.points).toBe(3);
        expect(res.breakdown.missing).toContain("engagement");
      });
    });
  });

  describe("Tier Boundaries & Data Completeness", () => {
    it("classifies total >= 70 as 'hot'", () => {
      // 25 (budget) + 25 (timeline) + 16 (booking) + 15 (pref) + 10 (eng) = 91 -> hot
      const res = computeLeadScore({
        budgetMin: 7000000,
        budgetMax: 7500000,
        projectMinPrice: 6500000,
        projectMaxPrice: 7600000,
        buyingTimeline: "within_1_month",
        hasConfirmedBooking: true,
        wants: "2BHK",
        messageCount: 4,
      });
      expect(res.total).toBeGreaterThanOrEqual(70);
      expect(res.tier).toBe("hot");
      expect(res.dataCompleteness).toBe("complete");
    });

    it("classifies total between 40 and 69 as 'warm'", () => {
      // 16 (budget) + 12 (timeline) + 4 (visit missing) + 15 (pref) + 6 (eng) = 53 -> warm
      const res = computeLeadScore({
        budgetMax: 6000000,
        projectMinPrice: 6500000,
        buyingTimeline: "3_to_6_months",
        wants: "3 BHK",
        messageCount: 1,
      });
      expect(res.total).toBeGreaterThanOrEqual(40);
      expect(res.total).toBeLessThan(70);
      expect(res.tier).toBe("warm");
      expect(res.dataCompleteness).toBe("partial");
    });

    it("classifies total < 40 as 'cold'", () => {
      // Missing all signals: 8 + 8 + 4 + 4 + 3 = 27 -> cold & insufficient
      const res = computeLeadScore({});
      expect(res.total).toBe(27);
      expect(res.tier).toBe("cold");
      expect(res.dataCompleteness).toBe("insufficient");
      expect(res.breakdown.missing.length).toBe(5);
    });
  });

  describe("Determinism and Demographic Agnosticism", () => {
    it("is strictly deterministic: same inputs always produce identical total and breakdown", () => {
      const input = {
        budgetMin: 7000000,
        budgetMax: 7500000,
        projectMinPrice: 6500000,
        projectMaxPrice: 7600000,
        buyingTimeline: "1_to_3_months" as const,
        hasConfirmedBooking: true,
        wants: "2 BHK",
        messageCount: 4,
      };

      const res1 = computeLeadScore(input);
      const res2 = computeLeadScore(input);
      expect(res1).toEqual(res2);
    });

    it("never considers personal or demographic attributes (name, phone, email, language)", () => {
      const baseInput = {
        budgetMax: 7200000,
        projectMinPrice: 6500000,
        projectMaxPrice: 7600000,
        buyingTimeline: "within_1_month" as const,
        wants: "2BHK",
        messageCount: 3,
      };

      const score1 = computeLeadScore(baseInput);

      // Attempt to pass demographic keys (which are not in LeadScoreInput or ignored)
      const inputWithDemographics = {
        ...baseInput,
        name: "Different Name",
        phone: "+919999999999",
        email: "other@domain.com",
        language: "hi",
      } as any;

      const score2 = computeLeadScore(inputWithDemographics);

      expect(score1.total).toBe(score2.total);
      expect(score1.tier).toBe(score2.tier);
      expect(score1.breakdown).toEqual(score2.breakdown);
    });
  });

  describe("High-Intent Handoff Trigger on Crossing into Hot", () => {
    it("triggers handoff with reason 'high_intent' on first crossing into hot", async () => {
      const mockLead = {
        id: "lead-hot-1",
        projectId: "proj-1",
        budgetMin: 7000000,
        budgetMax: 7500000,
        buyingTimeline: "within_1_month",
        wants: "2BHK",
      };

      // Mock DB client
      const mockClient = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table: any) => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([mockLead]),
            })),
          })),
        })),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue({}),
          }),
        }),
      };

      // Simulate recomputeLeadScore with mock client where previous score was cold/not hot
      // Custom mocked client that handles each step of recomputeLeadScore:
      let queryIdx = 0;
      const customClient = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => {
            queryIdx++;
            return {
              where: vi.fn().mockImplementation(() => {
                if (queryIdx === 1) {
                  // lead query
                  return { limit: vi.fn().mockResolvedValue([mockLead]) };
                }
                if (queryIdx === 2) {
                  // factSheetEntries query
                  return Promise.resolve([{ answerText: "Rs 65 Lakh to Rs 76 Lakh" }]);
                }
                if (queryIdx === 3) {
                  // bookings query
                  return Promise.resolve([{ status: "confirmed" }]);
                }
                if (queryIdx === 4) {
                  // conversations query
                  return Promise.resolve([{ id: "conv-1" }]);
                }
                if (queryIdx === 5) {
                  // messages query
                  return Promise.resolve([{ id: "msg-1" }, { id: "msg-2" }, { id: "msg-3" }, { id: "msg-4" }]);
                }
                if (queryIdx === 6) {
                  // previousScore query: was NOT hot
                  return { limit: vi.fn().mockResolvedValue([{ tier: "warm" }]) };
                }
                return Promise.resolve([]);
              }),
            };
          }),
        })),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue({}),
          }),
        }),
      };

      const result = await recomputeLeadScore("lead-hot-1", customClient as any);
      expect(result.tier).toBe("hot");
      expect(handoffService.createHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: "lead-hot-1",
          reason: "high_intent",
        })
      );
    });

    it("does NOT duplicate handoff when lead was already hot", async () => {
      let queryIdx = 0;
      const customClient = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => {
            queryIdx++;
            return {
              where: vi.fn().mockImplementation(() => {
                if (queryIdx === 1) {
                  // lead query
                  return {
                    limit: vi.fn().mockResolvedValue([{
                      id: "lead-already-hot",
                      projectId: "proj-1",
                      budgetMin: 7000000,
                      budgetMax: 7500000,
                      buyingTimeline: "within_1_month",
                      wants: "2BHK",
                    }]),
                  };
                }
                if (queryIdx === 2) {
                  // factSheetEntries query
                  return Promise.resolve([{ answerText: "Rs 65 Lakh to Rs 76 Lakh" }]);
                }
                if (queryIdx === 3) {
                  // bookings query
                  return Promise.resolve([{ status: "confirmed" }]);
                }
                if (queryIdx === 4) {
                  // conversations query
                  return Promise.resolve([{ id: "conv-1" }]);
                }
                if (queryIdx === 5) {
                  // messages query
                  return Promise.resolve([{ id: "msg-1" }, { id: "msg-2" }, { id: "msg-3" }, { id: "msg-4" }]);
                }
                if (queryIdx === 6) {
                  // previousScore query: was ALREADY hot
                  return { limit: vi.fn().mockResolvedValue([{ tier: "hot" }]) };
                }
                return Promise.resolve([]);
              }),
            };
          }),
        })),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue({}),
          }),
        }),
      };

      const result = await recomputeLeadScore("lead-already-hot", customClient as any);
      expect(result.tier).toBe("hot");
      expect(handoffService.createHandoff).not.toHaveBeenCalled();
    });
  });

  describe("Executive IDOR & Lead Priority Score Access Control", () => {
    it("masks score fields on GET /api/leads for an executive viewing non-assigned leads", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "exec-1",
        name: "Sales Executive 1",
        email: "exec1@example.com",
        role: "executive",
        isAdmin: false,
      });

      const req = new NextRequest("http://localhost:3000/api/leads");
      const res = await getLeadsList(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.leads).toHaveLength(2);

      // lead-1 is assigned to exec-1: score is preserved
      expect(data.leads[0].id).toBe("lead-1");
      expect(data.leads[0].scoreTotal).toBe(85);
      expect(data.leads[0].scoreTier).toBe("hot");

      // lead-2 is assigned to exec-2: score is masked to null
      expect(data.leads[1].id).toBe("lead-2");
      expect(data.leads[1].scoreTotal).toBeNull();
      expect(data.leads[1].scoreTier).toBeNull();
    });

    it("allows admin to view scores on all leads on GET /api/leads", async () => {
      vi.mocked(cookiesModule.getCurrentUser).mockResolvedValue({
        userId: "admin-1",
        name: "Admin Head",
        email: "admin@example.com",
        role: "admin",
        isAdmin: true,
      });

      const req = new NextRequest("http://localhost:3000/api/leads");
      const res = await getLeadsList(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.leads).toHaveLength(2);
      expect(data.leads[0].scoreTotal).toBe(85);
      expect(data.leads[1].scoreTotal).toBe(65);
    });
  });
});
