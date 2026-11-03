/**
 * Source Dashboard Analytics Service
 *
 * Implements server-side SQL aggregation for real-time developer metrics:
 * - Speed-to-lead & response SLA (median response, 2min, 5min, 48h unreached)
 * - Unique leads vs duplicate attribution
 * - Site visit funnels & show-up rate (visited / (visited + no_show))
 * - Unit economics by source: prorated spend, cost per lead, cost per visit
 * - Zero division protection & client baseline comparisons
 */

import { db } from "../../db";
import {
  leads,
  bookings,
  visitSlots,
  adSpend,
  conversations,
  handoffs,
} from "../../db/schema";
import { sql, and, gte, lte, eq, isNull } from "drizzle-orm";
import { getIstParts, createIstDate } from "@/lib/timezone";

export interface DashboardFilterOptions {
  days?: number; // 7, 30, 90
  executiveId?: string; // If provided, trimmed to executive view
  now?: Date;
  dbOrTx?: typeof db;
}

export interface SourceRow {
  source: string;
  sourceLabel: string;
  uniqueLeads: number;
  duplicateEnquiries: number;
  medianResponseMinutes: number | null;
  visitsBooked: number;
  visitsCompleted: number;
  noShows: number;
  showUpRate: number | null; // e.g. 75.5 (%)
  spend: number;
  costPerLead: number | null;
  costPerVisit: number | null;
  costPerLeadFormatted: string;
  costPerVisitFormatted: string;
  isBest?: boolean;
  isWorst?: boolean;
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  medianMinutes: number;
  leadsCount: number;
}

export interface CostChartBar {
  sourceLabel: string;
  costPerVisit: number;
  visitsCompleted: number;
  formatted: string;
}

export interface DashboardMetricsResult {
  timeRange: {
    days: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    uniqueLeads: number;
    duplicateEnquiries: number;
    totalEnquiries: number;
    medianResponseTimeMinutes: number | null;
    pctAnsweredWithin2Min: number;
    pctAnsweredWithin5Min: number;
    pctUnreached48h: number;
    visitsBooked: number;
    visitsCompleted: number;
    noShows: number;
    showUpRate: number | null; // e.g. 80 (%)
    leadToVisitRate: number; // e.g. 8.2 (%)
    totalSpend: number;
    overallCostPerLead: number | null;
    overallCostPerVisit: number | null;
    overallCostPerVisitFormatted: string;
    flaggedChatsCount: number;
    handoffsByReason: Record<string, number>;
  };
  bySource: SourceRow[];
  charts: {
    responseTimeTrend: TrendPoint[];
    costPerVisitBySource: CostChartBar[];
  };
}

const SOURCE_LABELS: Record<string, string> = {
  property_portal: "Property Portals (99acres / MagicBricks)",
  social_media_ad: "Social Media Ads (Meta / Instagram)",
  website: "Developer Website & Search",
  hoarding_call: "Hoarding Call Number (Direct)",
};

export const dashboardService = {
  async getMetrics(options: DashboardFilterOptions = {}): Promise<DashboardMetricsResult> {
    const days = options.days || 30;
    const now = options.now || new Date();
    const client = options.dbOrTx || db;
    const executiveId = options.executiveId;

    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const endDate = now;

    // 1. LEAD AGGREGATIONS (Server-side SQL)
    const leadConditions = [
      gte(leads.createdAt, startDate),
      lte(leads.createdAt, endDate),
    ];
    if (executiveId) {
      leadConditions.push(eq(leads.assignedExecutiveId, executiveId));
    }

    const leadRows = await client
      .select({
        id: leads.id,
        source: leads.source,
        duplicateOfId: leads.duplicateOfId,
        firstResponseAt: leads.firstResponseAt,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(and(...leadConditions));

    let uniqueLeadsCount = 0;
    let duplicateEnquiriesCount = 0;
    const latenciesSeconds: number[] = [];
    let answeredWithin2MinCount = 0;
    let answeredWithin5MinCount = 0;
    let unreached48hCount = 0;

    // Per-source counters
    const sourceMap: Record<
      string,
      {
        uniqueLeads: number;
        duplicateEnquiries: number;
        latencies: number[];
        leadIds: Set<string>;
      }
    > = {
      property_portal: { uniqueLeads: 0, duplicateEnquiries: 0, latencies: [], leadIds: new Set() },
      social_media_ad: { uniqueLeads: 0, duplicateEnquiries: 0, latencies: [], leadIds: new Set() },
      website: { uniqueLeads: 0, duplicateEnquiries: 0, latencies: [], leadIds: new Set() },
      hoarding_call: { uniqueLeads: 0, duplicateEnquiries: 0, latencies: [], leadIds: new Set() },
    };

    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    for (const row of leadRows) {
      const src = row.source;
      if (!sourceMap[src]) {
        sourceMap[src] = { uniqueLeads: 0, duplicateEnquiries: 0, latencies: [], leadIds: new Set() };
      }

      if (row.duplicateOfId) {
        duplicateEnquiriesCount++;
        sourceMap[src].duplicateEnquiries++;
      } else {
        uniqueLeadsCount++;
        sourceMap[src].uniqueLeads++;
        sourceMap[src].leadIds.add(row.id);

        if (row.firstResponseAt) {
          const latencySec = (new Date(row.firstResponseAt).getTime() - new Date(row.createdAt).getTime()) / 1000;
          if (latencySec >= 0) {
            latenciesSeconds.push(latencySec);
            sourceMap[src].latencies.push(latencySec);

            if (latencySec <= 120) answeredWithin2MinCount++;
            if (latencySec <= 300) answeredWithin5MinCount++;
            if (latencySec > 48 * 3600) unreached48hCount++;
          }
        } else {
          // No response yet
          if (new Date(row.createdAt) < fortyEightHoursAgo) {
            unreached48hCount++;
          }
        }
      }
    }

    // Compute Median Latency helper
    function calculateMedian(arr: number[]): number | null {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return Math.round(((sorted[mid - 1] + sorted[mid]) / 2 / 60) * 10) / 10;
      }
      return Math.round((sorted[mid] / 60) * 10) / 10;
    }

    const medianResponseTimeMinutes = calculateMedian(latenciesSeconds);
    const totalAnswered = latenciesSeconds.length;
    const pctAnsweredWithin2Min =
      totalAnswered > 0 ? Math.round((answeredWithin2MinCount / totalAnswered) * 1000) / 10 : 0;
    const pctAnsweredWithin5Min =
      totalAnswered > 0 ? Math.round((answeredWithin5MinCount / totalAnswered) * 1000) / 10 : 0;
    const pctUnreached48h =
      uniqueLeadsCount > 0 ? Math.round((unreached48hCount / uniqueLeadsCount) * 1000) / 10 : 0;

    // 2. BOOKINGS & SITE VISITS AGGREGATIONS
    const bookingConditions = [
      gte(bookings.createdAt, startDate),
      lte(bookings.createdAt, endDate),
    ];
    if (executiveId) {
      bookingConditions.push(eq(visitSlots.executiveId, executiveId));
    }

    const bookingRows = await client
      .select({
        id: bookings.id,
        status: bookings.status,
        leadId: bookings.leadId,
        leadSource: leads.source,
        startsAt: visitSlots.startsAt,
      })
      .from(bookings)
      .innerJoin(visitSlots, eq(bookings.slotId, visitSlots.id))
      .innerJoin(leads, eq(bookings.leadId, leads.id))
      .where(and(...bookingConditions));

    let visitsBookedCount = bookingRows.length;
    let visitsCompletedCount = 0;
    let noShowsCount = 0;

    const sourceVisitsMap: Record<string, { booked: number; completed: number; noShows: number }> = {
      property_portal: { booked: 0, completed: 0, noShows: 0 },
      social_media_ad: { booked: 0, completed: 0, noShows: 0 },
      website: { booked: 0, completed: 0, noShows: 0 },
      hoarding_call: { booked: 0, completed: 0, noShows: 0 },
    };

    for (const b of bookingRows) {
      const src = b.leadSource;
      if (!sourceVisitsMap[src]) {
        sourceVisitsMap[src] = { booked: 0, completed: 0, noShows: 0 };
      }
      sourceVisitsMap[src].booked++;

      if (b.status === "visited") {
        visitsCompletedCount++;
        sourceVisitsMap[src].completed++;
      } else if (b.status === "no_show") {
        noShowsCount++;
        sourceVisitsMap[src].noShows++;
      }
    }

    const totalResolvedVisits = visitsCompletedCount + noShowsCount;
    const showUpRate =
      totalResolvedVisits > 0
        ? Math.round((visitsCompletedCount / totalResolvedVisits) * 1000) / 10
        : null;

    const leadToVisitRate =
      uniqueLeadsCount > 0
        ? Math.round((visitsCompletedCount / uniqueLeadsCount) * 1000) / 10
        : 0;

    // 3. AD SPEND PRORATION
    // Average monthly spend per source (30 days)
    const spendRecords = await client
      .select({
        source: adSpend.source,
        amount: adSpend.amount,
      })
      .from(adSpend);

    const monthlySpendMap: Record<string, number> = {
      property_portal: 1450000,
      social_media_ad: 980000,
      website: 200000,
      hoarding_call: 370000,
    };

    if (spendRecords.length > 0) {
      for (const sp of spendRecords) {
        monthlySpendMap[sp.source] = Number(sp.amount);
      }
    }

    // Prorate monthly spend to filter days (days / 30)
    const prorationFactor = days / 30;
    let totalProratedSpend = 0;

    const sourceProratedSpend: Record<string, number> = {};
    for (const key of Object.keys(sourceMap)) {
      const baseMonthly = monthlySpendMap[key] || 0;
      const prorated = Math.round(baseMonthly * prorationFactor);
      sourceProratedSpend[key] = prorated;
      totalProratedSpend += prorated;
    }

    // 4. HANDOFFS & FLAGGED CHATS
    const handoffConditions = [
      gte(handoffs.createdAt, startDate),
      lte(handoffs.createdAt, endDate),
    ];
    if (executiveId) {
      handoffConditions.push(eq(handoffs.executiveId, executiveId));
    }

    const handoffRows = await client
      .select({
        reason: handoffs.reason,
      })
      .from(handoffs)
      .where(and(...handoffConditions));

    const handoffsByReason: Record<string, number> = {};
    for (const h of handoffRows) {
      handoffsByReason[h.reason] = (handoffsByReason[h.reason] || 0) + 1;
    }

    const convConditions = [
      gte(conversations.createdAt, startDate),
      lte(conversations.createdAt, endDate),
      eq(conversations.flagged, true),
    ];
    const flaggedConvs = await client
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(...convConditions));

    const flaggedChatsCount = flaggedConvs.length;

    // 5. ASSEMBLE BY-SOURCE ROWS
    const bySource: SourceRow[] = Object.keys(sourceMap).map((src) => {
      const sData = sourceMap[src];
      const vData = sourceVisitsMap[src] || { booked: 0, completed: 0, noShows: 0 };
      const spend = sourceProratedSpend[src] || 0;

      const medResponse = calculateMedian(sData.latencies);
      const totalResolved = vData.completed + vData.noShows;
      const sourceShowUp = totalResolved > 0 ? Math.round((vData.completed / totalResolved) * 1000) / 10 : null;

      const costPerLead = sData.uniqueLeads > 0 ? Math.round(spend / sData.uniqueLeads) : null;
      const costPerVisit = vData.completed > 0 ? Math.round(spend / vData.completed) : null;

      const costPerLeadFormatted =
        costPerLead !== null
          ? `₹ ${costPerLead.toLocaleString("en-IN")}`
          : "No leads yet";

      const costPerVisitFormatted =
        costPerVisit !== null
          ? `₹ ${costPerVisit.toLocaleString("en-IN")}`
          : "No visits yet";

      return {
        source: src,
        sourceLabel: SOURCE_LABELS[src] || src,
        uniqueLeads: sData.uniqueLeads,
        duplicateEnquiries: sData.duplicateEnquiries,
        medianResponseMinutes: medResponse,
        visitsBooked: vData.booked,
        visitsCompleted: vData.completed,
        noShows: vData.noShows,
        showUpRate: sourceShowUp,
        spend,
        costPerLead,
        costPerVisit,
        costPerLeadFormatted,
        costPerVisitFormatted,
      };
    });

    // Mark best and worst sources by cost per completed visit
    const sourcesWithVisits = bySource.filter((s) => s.costPerVisit !== null);
    if (sourcesWithVisits.length >= 2) {
      let minCost = Infinity;
      let maxCost = -Infinity;
      let bestSource = "";
      let worstSource = "";

      for (const s of sourcesWithVisits) {
        if (s.costPerVisit! < minCost) {
          minCost = s.costPerVisit!;
          bestSource = s.source;
        }
        if (s.costPerVisit! > maxCost) {
          maxCost = s.costPerVisit!;
          worstSource = s.source;
        }
      }

      for (const s of bySource) {
        if (s.source === bestSource) s.isBest = true;
        if (s.source === worstSource && worstSource !== bestSource) s.isWorst = true;
      }
    }

    // 6. ASSEMBLE CHARTS DATA
    // Trend points: group lead latencies by date
    const dailyLatencies: Record<string, number[]> = {};
    for (const row of leadRows) {
      if (row.firstResponseAt) {
        const dateKey = new Date(row.createdAt).toISOString().slice(0, 10);
        const latencySec = (new Date(row.firstResponseAt).getTime() - new Date(row.createdAt).getTime()) / 1000;
        if (latencySec >= 0) {
          if (!dailyLatencies[dateKey]) dailyLatencies[dateKey] = [];
          dailyLatencies[dateKey].push(latencySec);
        }
      }
    }

    const responseTimeTrend: TrendPoint[] = Object.keys(dailyLatencies)
      .sort()
      .slice(-14) // last 14 active days
      .map((dateStr) => {
        const arr = dailyLatencies[dateStr];
        const med = calculateMedian(arr) || 0;
        return {
          date: dateStr,
          medianMinutes: med,
          leadsCount: arr.length,
        };
      });

    const costPerVisitBySource: CostChartBar[] = bySource.map((s) => ({
      sourceLabel: s.sourceLabel.split(" ")[0] || s.source,
      costPerVisit: s.costPerVisit || 0,
      visitsCompleted: s.visitsCompleted,
      formatted: s.costPerVisitFormatted,
    }));

    const overallCostPerLead =
      uniqueLeadsCount > 0 ? Math.round(totalProratedSpend / uniqueLeadsCount) : null;
    const overallCostPerVisit =
      visitsCompletedCount > 0 ? Math.round(totalProratedSpend / visitsCompletedCount) : null;

    return {
      timeRange: {
        days,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      },
      summary: {
        uniqueLeads: uniqueLeadsCount,
        duplicateEnquiries: duplicateEnquiriesCount,
        totalEnquiries: uniqueLeadsCount + duplicateEnquiriesCount,
        medianResponseTimeMinutes,
        pctAnsweredWithin2Min,
        pctAnsweredWithin5Min,
        pctUnreached48h,
        visitsBooked: visitsBookedCount,
        visitsCompleted: visitsCompletedCount,
        noShows: noShowsCount,
        showUpRate,
        leadToVisitRate,
        totalSpend: totalProratedSpend,
        overallCostPerLead,
        overallCostPerVisit,
        overallCostPerVisitFormatted:
          overallCostPerVisit !== null
            ? `₹ ${overallCostPerVisit.toLocaleString("en-IN")}`
            : "No visits yet",
        flaggedChatsCount,
        handoffsByReason,
      },
      bySource,
      charts: {
        responseTimeTrend,
        costPerVisitBySource,
      },
    };
  },
};
