"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DashboardData {
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
    showUpRate: number | null;
    leadToVisitRate: number;
    totalSpend: number;
    overallCostPerLead: number | null;
    overallCostPerVisit: number | null;
    overallCostPerVisitFormatted: string;
    flaggedChatsCount: number;
    handoffsByReason: Record<string, number>;
  };
  bySource: Array<{
    source: string;
    sourceLabel: string;
    uniqueLeads: number;
    duplicateEnquiries: number;
    medianResponseMinutes: number | null;
    visitsBooked: number;
    visitsCompleted: number;
    noShows: number;
    showUpRate: number | null;
    spend: number;
    costPerLead: number | null;
    costPerVisit: number | null;
    costPerLeadFormatted: string;
    costPerVisitFormatted: string;
    isBest?: boolean;
    isWorst?: boolean;
  }>;
  charts: {
    responseTimeTrend: Array<{
      date: string;
      medianMinutes: number;
      leadsCount: number;
    }>;
    costPerVisitBySource: Array<{
      sourceLabel: string;
      costPerVisit: number;
      visitsCompleted: number;
      formatted: string;
    }>;
  };
  leadPriority?: {
    disclaimer: string;
    tiers: Array<{
      tier: "hot" | "warm" | "cold";
      tierLabel: string;
      leadCount: number;
      completedVisits: number;
      visitRate: number;
    }>;
    totalScoredLeads: number;
  };
}

export default function AdminDashboardPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [showAccessibleTables, setShowAccessibleTables] = useState(false);
  const [isTriggeringReminders, setIsTriggeringReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/dashboard?days=${days}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load dashboard metrics");
      }
      setData(json);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Demo action: Trigger due reminders immediately
  async function handleRunReminders() {
    setIsTriggeringReminders(true);
    setReminderResult(null);
    try {
      const res = await fetch("/api/admin/reminders/run", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to dispatch reminders");
      }
      setReminderResult(
        `Dispatched! ${json.sent} reminder(s) sent, ${json.skippedOptedOut || 0} skipped (opt-out), ${
          json.skippedCancelled || 0
        } skipped (cancelled).`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error running reminders");
    } finally {
      setIsTriggeringReminders(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16">
      {/* 1. Header & Range Navigation */}
      <div className="border-b border-[#EBE7DF] bg-white px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
                  Sales Head Admin
                </span>
                <span className="text-xs text-[#7A7973]">&bull; Developer Attribution &amp; Funnel</span>
              </div>
              <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#141413] sm:text-3xl">
                Source Attribution &amp; Performance Dashboard
              </h1>
              <p className="mt-1 text-xs text-[#7A7973]">
                Ahmedabad residential sales intelligence for Project 1 &amp; Project 2. Real data aggregated via SQL.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Range Filters */}
              <div className="flex rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-1">
                {([7, 30, 90] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDays(r)}
                    className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      days === r
                        ? "bg-[#8C653D] text-white shadow-2xs"
                        : "text-[#7A7973] hover:text-[#141413]"
                    }`}
                  >
                    Last {r} Days
                  </button>
                ))}
              </div>

              {/* Quick Admin Actions */}
              <button
                type="button"
                onClick={handleRunReminders}
                disabled={isTriggeringReminders}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-3.5 py-2 text-xs font-medium text-[#141413] hover:bg-[#FAF9F6] disabled:opacity-50"
              >
                {isTriggeringReminders ? "Sending..." : "⚡ Send Due Reminders"}
              </button>

              <button
                type="button"
                onClick={() => setShowCalculationModal(true)}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-3.5 py-2 text-xs font-medium text-[#8C653D] hover:bg-[#FAF6F0]"
              >
                ℹ How this is calculated
              </button>
            </div>
          </div>

          {/* Quick Sub-navigation */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#F2EFE9] pt-3 text-xs">
            <span className="text-[#7A7973]">Quick Admin Links:</span>
            <Link href="/admin/slots" className="font-medium text-[#8C653D] hover:underline">
              Slot Grid Editor
            </Link>
            <span className="text-stone-300">&bull;</span>
            <Link href="/admin/review" className="font-medium text-[#8C653D] hover:underline">
              Flagged Review Queue
            </Link>
            <span className="text-stone-300">&bull;</span>
            <Link href="/admin/facts" className="font-medium text-[#8C653D] hover:underline">
              Fact Sheet Editor
            </Link>
            <span className="text-stone-300">&bull;</span>
            <Link href="/admin/messages" className="font-medium text-[#8C653D] hover:underline">
              Notification Logs
            </Link>
          </div>

          {reminderResult && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between">
              <span>{reminderResult}</span>
              <button
                type="button"
                onClick={() => setReminderResult(null)}
                className="text-emerald-700 font-bold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 space-y-6">
        {errorMsg ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <h3 className="text-sm font-semibold text-red-900">Failed to load metrics</h3>
            <p className="mt-1 text-xs text-red-700">{errorMsg}</p>
            <button
              type="button"
              onClick={loadMetrics}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700"
            >
              Retry Loading
            </button>
          </div>
        ) : isLoading || !data ? (
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#8C653D] border-t-transparent" />
            <p className="mt-3 text-xs text-[#7A7973]">Aggregating server-side developer analytics...</p>
          </div>
        ) : (
          <>
            {/* 2. Target vs Baseline Hero Comparison */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Metric 1: Median First Response Time */}
              <div className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs">
                <span className="text-xs font-medium text-[#7A7973]">Median First Response</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-3xl font-bold tracking-tight text-[#141413]">
                    {data.summary.medianResponseTimeMinutes !== null
                      ? `${data.summary.medianResponseTimeMinutes} min`
                      : "Instant"}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {data.summary.pctAnsweredWithin2Min}% &le; 2m
                  </span>
                </div>
                <div className="mt-3 border-t border-[#F2EFE9] pt-2 text-[11px] text-[#7A7973]">
                  <span className="font-semibold text-stone-600">Before: 14 h</span>{" "}
                  <span className="text-stone-400">(Client-reported baseline)</span>
                </div>
              </div>

              {/* Metric 2: Leads Unreached in 48h */}
              <div className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs">
                <span className="text-xs font-medium text-[#7A7973]">Unreached in 48 Hours</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-3xl font-bold tracking-tight text-[#141413]">
                    {data.summary.pctUnreached48h}%
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Target &lt; 5%
                  </span>
                </div>
                <div className="mt-3 border-t border-[#F2EFE9] pt-2 text-[11px] text-[#7A7973]">
                  <span className="font-semibold text-stone-600">Before: 35%</span>{" "}
                  <span className="text-stone-400">(Client-reported baseline)</span>
                </div>
              </div>

              {/* Metric 3: Lead to Visit Rate */}
              <div className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs">
                <span className="text-xs font-medium text-[#7A7973]">Lead-to-Visit Rate</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-3xl font-bold tracking-tight text-[#141413]">
                    {data.summary.leadToVisitRate}%
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                      data.summary.leadToVisitRate >= 8.0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    Target 8.0%
                  </span>
                </div>
                <div className="mt-3 border-t border-[#F2EFE9] pt-2 text-[11px] text-[#7A7973]">
                  <span className="font-semibold text-stone-600">Before: 6.0%</span>{" "}
                  <span className="text-stone-400">(Client-reported baseline)</span>
                </div>
              </div>

              {/* Metric 4: Show-Up Rate */}
              <div className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs">
                <span className="text-xs font-medium text-[#7A7973]">Visit Show-Up Rate</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-3xl font-bold tracking-tight text-[#141413]">
                    {data.summary.showUpRate !== null ? `${data.summary.showUpRate}%` : "N/A"}
                  </span>
                  <span className="text-[11px] text-[#7A7973]">
                    {data.summary.visitsCompleted} visited / {data.summary.noShows} no-shows
                  </span>
                </div>
                <div className="mt-3 border-t border-[#F2EFE9] pt-2 text-[11px] text-[#7A7973]">
                  <span className="font-semibold text-emerald-800">
                    {data.summary.visitsBooked} total booked
                  </span>{" "}
                  <span className="text-stone-400">(Auto-reminded 24h &amp; 2h)</span>
                </div>
              </div>
            </div>

            {/* 3. Secondary Metrics Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#EBE7DF] bg-white p-4">
                <span className="text-xs text-[#7A7973]">Unique Prospective Buyers</span>
                <div className="mt-1 font-mono text-xl font-bold text-[#141413]">
                  {data.summary.uniqueLeads}
                </div>
                <span className="text-[10px] text-[#7A7973]">
                  +{data.summary.duplicateEnquiries} duplicate inquiries tracked
                </span>
              </div>

              <div className="rounded-xl border border-[#EBE7DF] bg-white p-4">
                <span className="text-xs text-[#7A7973]">Total Prorated Spend</span>
                <div className="mt-1 font-mono text-xl font-bold text-[#141413]">
                  ₹ {data.summary.totalSpend.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-[#7A7973]">Across 4 marketing channels</span>
              </div>

              <div className="rounded-xl border border-[#EBE7DF] bg-white p-4">
                <span className="text-xs text-[#7A7973]">Cost Per Completed Visit</span>
                <div className="mt-1 font-mono text-xl font-bold text-[#8C653D]">
                  {data.summary.overallCostPerVisitFormatted}
                </div>
                <span className="text-[10px] text-[#7A7973]">Spend &divide; completed visits</span>
              </div>

              <div className="rounded-xl border border-[#EBE7DF] bg-white p-4">
                <span className="text-xs text-[#7A7973]">Flagged Conversations</span>
                <div className="mt-1 font-mono text-xl font-bold text-amber-900">
                  {data.summary.flaggedChatsCount}
                </div>
                <Link
                  href="/admin/review"
                  className="text-[10px] font-medium text-[#8C653D] hover:underline block"
                >
                  Review in queue &rarr;
                </Link>
              </div>
            </div>

            {/* Lead Priority Score Tiers & Conversion */}
            {data.leadPriority && (
              <div className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#F2EFE9] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-base font-bold text-[#141413]">
                        Lead Priority Tiers &amp; Visit Conversion
                      </h3>
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        {data.leadPriority.disclaimer}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#7A7973]">
                      Lead breakdown across priority tiers and completed site visit rates.
                    </p>
                  </div>
                  <div className="text-xs text-[#7A7973]">
                    <span className="font-semibold text-[#141413]">{data.leadPriority.totalScoredLeads}</span> scored leads in window
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {data.leadPriority.tiers.map((t) => {
                    const isHot = t.tier === "hot";
                    const isWarm = t.tier === "warm";

                    return (
                      <div
                        key={t.tier}
                        className={`rounded-xl border p-4 transition ${
                          isHot
                            ? "border-red-200 bg-red-50/30"
                            : isWarm
                            ? "border-amber-200 bg-amber-50/30"
                            : "border-slate-200 bg-slate-50/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isHot
                                ? "bg-red-100 text-red-800"
                                : isWarm
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-800"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isHot ? "bg-red-600" : isWarm ? "bg-amber-600" : "bg-slate-500"
                              }`}
                            />
                            {t.tierLabel}
                          </span>
                          <span className="font-mono text-sm font-bold text-[#141413]">
                            {t.visitRate}% Visit Rate
                          </span>
                        </div>

                        <div className="mt-3 flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] text-[#7A7973] block">Leads in Tier</span>
                            <span className="font-mono text-xl font-bold text-[#141413]">{t.leadCount}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[#7A7973] block">Completed Visits</span>
                            <span className="font-mono text-xl font-bold text-emerald-800">{t.completedVisits}</span>
                          </div>
                        </div>

                        {/* Visual rate bar */}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-200">
                          <div
                            className={`h-full rounded-full ${
                              isHot ? "bg-red-500" : isWarm ? "bg-amber-500" : "bg-slate-400"
                            }`}
                            style={{ width: `${Math.min(100, t.visitRate)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Charts: SVG Visualizations with Tabular Fallbacks */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Chart 1: Response Time Trend Line */}
              <div className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#F2EFE9]">
                  <div>
                    <h3 className="font-serif text-base font-bold text-[#141413]">
                      Response Time Trend (Minutes)
                    </h3>
                    <p className="text-xs text-[#7A7973]">Daily median latency across inquiries</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAccessibleTables(!showAccessibleTables)}
                    className="text-[11px] font-medium text-[#8C653D] hover:underline"
                  >
                    {showAccessibleTables ? "Show Chart View" : "Accessible Table"}
                  </button>
                </div>

                {!showAccessibleTables ? (
                  <div className="mt-4">
                    {data.charts.responseTimeTrend.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[#7A7973]">
                        No inquiry response latency data in this time range.
                      </div>
                    ) : (
                      <div className="relative h-48 w-full pt-4">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                          {/* Grid lines */}
                          <line x1="0" y1="30" x2="500" y2="30" stroke="#F2EFE9" strokeDasharray="3,3" />
                          <line x1="0" y1="75" x2="500" y2="75" stroke="#F2EFE9" strokeDasharray="3,3" />
                          <line x1="0" y1="120" x2="500" y2="120" stroke="#F2EFE9" />

                          {/* 2-minute SLA Target Line */}
                          <line x1="0" y1="100" x2="500" y2="100" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4,4" />
                          <text x="4" y="96" fill="#10B981" fontSize="9" fontWeight="bold">
                            2 min AI SLA Target
                          </text>

                          {/* Data Polyline */}
                          {(() => {
                            const points = data.charts.responseTimeTrend;
                            const maxVal = Math.max(...points.map((p) => p.medianMinutes), 10);
                            const svgPoints = points
                              .map((p, idx) => {
                                const x = points.length === 1 ? 250 : (idx / (points.length - 1)) * 480 + 10;
                                const y = 130 - (p.medianMinutes / maxVal) * 110;
                                return `${x},${Math.max(10, Math.min(135, y))}`;
                              })
                              .join(" ");

                            return (
                              <>
                                <polyline
                                  fill="none"
                                  stroke="#8C653D"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  points={svgPoints}
                                />
                                {points.map((p, idx) => {
                                  const x = points.length === 1 ? 250 : (idx / (points.length - 1)) * 480 + 10;
                                  const y = Math.max(10, Math.min(135, 130 - (p.medianMinutes / maxVal) * 110));
                                  return (
                                    <g key={idx}>
                                      <circle cx={x} cy={y} r="3.5" fill="#8C653D" />
                                      <title>{`${p.date}: ${p.medianMinutes} min (${p.leadsCount} inquiries)`}</title>
                                    </g>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </svg>
                        <div className="mt-2 flex justify-between text-[10px] text-[#7A7973]">
                          <span>{data.charts.responseTimeTrend[0]?.date}</span>
                          <span>
                            {data.charts.responseTimeTrend[data.charts.responseTimeTrend.length - 1]?.date}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF9F6] text-[#7A7973]">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Median Latency</th>
                          <th className="p-2">Inquiries</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2EFE9]">
                        {data.charts.responseTimeTrend.map((t) => (
                          <tr key={t.date}>
                            <td className="p-2 font-mono">{t.date}</td>
                            <td className="p-2 font-semibold">{t.medianMinutes} min</td>
                            <td className="p-2">{t.leadsCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Chart 2: Cost Per Completed Visit By Source */}
              <div className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#F2EFE9]">
                  <div>
                    <h3 className="font-serif text-base font-bold text-[#141413]">
                      Cost per Completed Visit (₹)
                    </h3>
                    <p className="text-xs text-[#7A7973]">Unit economics by acquisition channel</p>
                  </div>
                  <span className="text-[11px] font-medium text-[#7A7973]">Lower is better</span>
                </div>

                <div className="mt-4 space-y-3">
                  {data.charts.costPerVisitBySource.map((bar, idx) => {
                    const maxCost = Math.max(
                      ...data.charts.costPerVisitBySource.map((b) => b.costPerVisit),
                      1
                    );
                    const pct = Math.max(5, (bar.costPerVisit / maxCost) * 100);

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-[#141413]">{bar.sourceLabel}</span>
                          <span className="font-mono text-stone-700">{bar.formatted}</span>
                        </div>
                        <div className="h-4 w-full bg-[#FAF9F6] rounded-full overflow-hidden border border-[#EBE7DF]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              bar.costPerVisit === 0
                                ? "bg-stone-200"
                                : idx === 0
                                ? "bg-[#8C653D]"
                                : idx === 1
                                ? "bg-[#B08968]"
                                : idx === 2
                                ? "bg-[#7F5539]"
                                : "bg-[#9C6644]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-[#7A7973]">
                          {bar.visitsCompleted} completed site visit(s)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5. By-Source Comprehensive Table */}
            <div className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#F2EFE9]">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#141413]">
                    Marketing Channel Breakdown
                  </h3>
                  <p className="text-xs text-[#7A7973]">
                    Multi-touch source attribution: inquiries, conversion rates, and acquisition costs.
                  </p>
                </div>
                <span className="text-xs text-[#7A7973]">
                  Prorated for {data.timeRange.days} days ({data.timeRange.startDate} to {data.timeRange.endDate})
                </span>
              </div>

              {/* Desktop Table View */}
              <div className="mt-4 hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F6] text-[#7A7973] border-b border-[#EBE7DF]">
                    <tr>
                      <th className="p-3 font-medium">Acquisition Channel</th>
                      <th className="p-3 font-medium text-right">Unique Leads</th>
                      <th className="p-3 font-medium text-right">Duplicates</th>
                      <th className="p-3 font-medium text-right">Median Response</th>
                      <th className="p-3 font-medium text-right">Booked</th>
                      <th className="p-3 font-medium text-right">Completed</th>
                      <th className="p-3 font-medium text-right">Show-Up</th>
                      <th className="p-3 font-medium text-right">Prorated Spend</th>
                      <th className="p-3 font-medium text-right">Cost / Lead</th>
                      <th className="p-3 font-medium text-right">Cost / Visit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EFE9]">
                    {data.bySource.map((s) => (
                      <tr key={s.source} className="hover:bg-[#FAF9F6]">
                        <td className="p-3 font-medium text-[#141413]">
                          <div className="flex items-center gap-1.5">
                            <span>{s.sourceLabel}</span>
                            {s.isBest && (
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                                Best Efficiency
                              </span>
                            )}
                            {s.isWorst && (
                              <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                High Cost
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-right font-semibold">{s.uniqueLeads}</td>
                        <td className="p-3 font-mono text-right text-[#7A7973]">+{s.duplicateEnquiries}</td>
                        <td className="p-3 font-mono text-right">
                          {s.medianResponseMinutes !== null ? `${s.medianResponseMinutes} min` : "—"}
                        </td>
                        <td className="p-3 font-mono text-right">{s.visitsBooked}</td>
                        <td className="p-3 font-mono text-right font-semibold text-[#141413]">
                          {s.visitsCompleted}
                        </td>
                        <td className="p-3 font-mono text-right">
                          {s.showUpRate !== null ? `${s.showUpRate}%` : "N/A"}
                        </td>
                        <td className="p-3 font-mono text-right">
                          ₹ {s.spend.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 font-mono text-right font-medium text-stone-700">
                          {s.costPerLeadFormatted}
                        </td>
                        <td className="p-3 font-mono text-right font-bold text-[#8C653D]">
                          {s.costPerVisitFormatted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (< 768px / 375px) */}
              <div className="mt-4 space-y-3 md:hidden">
                {data.bySource.map((s) => (
                  <div
                    key={s.source}
                    className="rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-4 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-[#141413]">{s.sourceLabel}</span>
                      <div className="flex gap-1">
                        {s.isBest && (
                          <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">
                            Best
                          </span>
                        )}
                        {s.isWorst && (
                          <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                            High Cost
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#EBE7DF] text-[11px]">
                      <div>
                        <span className="text-[#7A7973]">Unique Leads:</span>{" "}
                        <strong className="font-mono">{s.uniqueLeads}</strong>{" "}
                        <span className="text-stone-400">({s.duplicateEnquiries} dup)</span>
                      </div>
                      <div>
                        <span className="text-[#7A7973]">Completed Visits:</span>{" "}
                        <strong className="font-mono">{s.visitsCompleted}</strong>
                      </div>
                      <div>
                        <span className="text-[#7A7973]">Show-Up Rate:</span>{" "}
                        <strong className="font-mono">{s.showUpRate !== null ? `${s.showUpRate}%` : "N/A"}</strong>
                      </div>
                      <div>
                        <span className="text-[#7A7973]">Median Response:</span>{" "}
                        <strong className="font-mono">{s.medianResponseMinutes !== null ? `${s.medianResponseMinutes}m` : "—"}</strong>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-[#F2EFE9] flex justify-between font-mono">
                        <span className="text-[#7A7973]">Cost per Completed Visit:</span>
                        <strong className="text-[#8C653D]">{s.costPerVisitFormatted}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* "How This Is Calculated" Modal */}
      {showCalculationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto text-xs leading-relaxed">
            <div className="flex items-center justify-between border-b border-[#EBE7DF] pb-3">
              <h3 className="font-serif text-base font-bold text-[#141413]">
                Metric Calculation Methodology
              </h3>
              <button
                type="button"
                onClick={() => setShowCalculationModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg leading-none p-1"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[#575651]">
              <p>
                All figures are computed server-side directly from indexed PostgreSQL tables (documented in{" "}
                <code className="bg-stone-100 px-1 py-0.5 rounded">docs/metrics.md</code>).
              </p>
              <div className="space-y-2 border-t border-[#F2EFE9] pt-3">
                <p>
                  <strong>Unique Leads:</strong> Count of distinct prospective buyers created in the selected window where <code className="text-stone-700">duplicate_of_id IS NULL</code>.
                </p>
                <p>
                  <strong>Duplicate Enquiries:</strong> Count of re-inquiries linked to a canonical lead (<code className="text-stone-700">duplicate_of_id IS NOT NULL</code>), attributed to their respective acquisition channel.
                </p>
                <p>
                  <strong>Median First Response:</strong> The 50th percentile latency (<code className="text-stone-700">first_response_at - created_at</code>). Compare against developer baseline of 14 hours.
                </p>
                <p>
                  <strong>Show-Up Rate:</strong> Formula is <code className="text-stone-700">visited / (visited + no_show)</code>. When total resolved visits is 0, displays N/A.
                </p>
                <p>
                  <strong>Cost per Completed Visit:</strong> Prorated advertising spend for the period divided by completed site visits. When zero visits exist, displays &quot;No visits yet&quot; (never division by zero).
                </p>
                <p>
                  <strong>Lead-to-Visit Rate:</strong> Completed visits divided by unique leads (compare against 6.0% baseline and 8.0% target).
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-[#EBE7DF] pt-3">
              <button
                type="button"
                onClick={() => setShowCalculationModal(false)}
                className="min-h-[44px] rounded-xl bg-[#8C653D] px-4 py-2 text-xs font-medium text-white hover:bg-[#704E2D]"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
