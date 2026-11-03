"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface ExecutiveDashboardData {
  timeRange: {
    days: number;
    startDate: string;
    endDate: string;
  };
  executiveName?: string;
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
    handoffsByReason: Record<string, number>;
  };
  charts: {
    responseTimeTrend: Array<{
      date: string;
      medianMinutes: number;
      leadsCount: number;
    }>;
  };
}

export default function ExecutiveDashboardPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAccessibleTables, setShowAccessibleTables] = useState(false);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/executive/dashboard?days=${days}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load executive dashboard metrics");
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

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1C1917] pb-16 font-sans">
      {/* Top Navigation */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/executive/leads"
              className="text-stone-500 hover:text-stone-900 transition-colors text-xs uppercase tracking-wider font-medium"
            >
              &larr; Executive Workspace
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-stone-900 font-semibold text-sm">Performance Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/executive/visits"
              className="text-xs font-medium text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-stone-300 transition-colors"
            >
              My Site Visits
            </Link>
            <Link
              href="/executive/leads"
              className="text-xs font-medium bg-[#1F4E3D] text-white px-3 py-1.5 rounded-lg hover:bg-[#16382c] transition-colors"
            >
              My Assigned Leads
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Page Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              Personal Sales Performance
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              {data?.executiveName ? `Metrics for ${data.executiveName} · ` : ""}
              Individual response speed, enquiry resolution, and site visit conversion.
            </p>
          </div>

          {/* Time range selector */}
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-1 self-start sm:self-auto shadow-sm">
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  days === r
                    ? "bg-[#1F4E3D] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                Last {r} Days
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs sm:text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={() => loadMetrics()}
              className="underline font-semibold hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="p-12 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-stone-300 border-t-[#1F4E3D] rounded-full mb-2" />
            <p className="text-xs font-medium">Aggregating your performance metrics...</p>
          </div>
        ) : data ? (
          <>
            {/* Primary KPI Hero Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Unique Assigned Leads */}
              <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500">
                    Assigned Unique Leads
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-stone-900">
                      {data.summary.uniqueLeads}
                    </span>
                    <span className="text-xs text-stone-500">canonical buyers</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500">
                  Total incoming enquiries:{" "}
                  <span className="font-semibold text-stone-700">
                    {data.summary.totalEnquiries}
                  </span>{" "}
                  ({data.summary.duplicateEnquiries} repeat contacts)
                </div>
              </div>

              {/* Card 2: Median First Response */}
              <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500">
                    Median First Response
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-stone-900">
                      {data.summary.medianResponseTimeMinutes !== null
                        ? `${data.summary.medianResponseTimeMinutes}m`
                        : "N/A"}
                    </span>
                    <span className="text-xs text-stone-500">
                      {data.summary.medianResponseTimeMinutes !== null &&
                      data.summary.medianResponseTimeMinutes <= 5 ? (
                        <span className="text-emerald-700 font-medium">Within Target (&le;5m)</span>
                      ) : (
                        "minutes"
                      )}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex justify-between">
                  <span>Baseline: 14 h</span>
                  <span className="font-medium text-emerald-700">
                    {data.summary.pctAnsweredWithin2Min}% &le; 2m
                  </span>
                </div>
              </div>

              {/* Card 3: Site Visits Show-up Rate */}
              <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500">
                    Site Visit Show-Up Rate
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-stone-900">
                      {data.summary.showUpRate !== null ? `${data.summary.showUpRate}%` : "No visits"}
                    </span>
                    {data.summary.showUpRate !== null && (
                      <span className="text-xs text-stone-500">
                        {data.summary.showUpRate >= 70 ? (
                          <span className="text-emerald-700 font-medium">High attendance</span>
                        ) : (
                          "attendance"
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex justify-between">
                  <span>{data.summary.visitsCompleted} visited</span>
                  <span>{data.summary.noShows} no-shows</span>
                </div>
              </div>

              {/* Card 4: Lead-to-Visit Conversion */}
              <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500">
                    Lead-to-Visit Conversion
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-stone-900">
                      {data.summary.leadToVisitRate}%
                    </span>
                    <span className="text-xs text-stone-500">
                      {data.summary.leadToVisitRate >= 8 ? (
                        <span className="text-emerald-700 font-medium">Goal reached (8%)</span>
                      ) : (
                        "of unique leads"
                      )}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex justify-between">
                  <span>Pre-AI Baseline: 6%</span>
                  <span className="font-semibold text-stone-700">Target: 8%</span>
                </div>
              </div>
            </div>

            {/* SLA Response Breakdown Strip */}
            <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <div className="text-xs font-semibold text-stone-900 uppercase tracking-wider mb-3">
                Speed-to-Lead SLA Performance
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                  <div className="text-xs text-stone-500">Enquiries Answered &le; 2 Min</div>
                  <div className="text-2xl font-serif font-bold text-[#1F4E3D] mt-1">
                    {data.summary.pctAnsweredWithin2Min}%
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Immediate instant engagement via AI assistant.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                  <div className="text-xs text-stone-500">Enquiries Answered &le; 5 Min</div>
                  <div className="text-2xl font-serif font-bold text-stone-900 mt-1">
                    {data.summary.pctAnsweredWithin5Min}%
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Contractual SLA target for all inbound buyers.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-100">
                  <div className="text-xs text-stone-500">Unreached After 48 Hours</div>
                  <div className="text-2xl font-serif font-bold text-stone-900 mt-1">
                    {data.summary.pctUnreached48h}%
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Before: 35% unreached · Goal: &lt; 5%.
                  </div>
                </div>
              </div>
            </div>

            {/* Visuals: Response Time Trend Line */}
            <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-stone-900">
                    First Response Latency Trend (Daily Median)
                  </h2>
                  <p className="text-xs text-stone-500">
                    Daily median minutes to answer new incoming buyer enquiries.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAccessibleTables((prev) => !prev)}
                  className="text-xs font-medium text-stone-600 hover:text-stone-900 underline self-start sm:self-auto"
                >
                  {showAccessibleTables ? "Show Chart View" : "Show Accessible Table Fallback"}
                </button>
              </div>

              {showAccessibleTables ? (
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-xs text-left text-stone-700">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Date (IST)</th>
                        <th className="py-2 px-3 font-semibold">Median Response (min)</th>
                        <th className="py-2 px-3 font-semibold">Enquiries Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.charts.responseTimeTrend.map((row) => (
                        <tr key={row.date} className="hover:bg-stone-50">
                          <td className="py-2 px-3 font-mono">{row.date}</td>
                          <td className="py-2 px-3 font-semibold text-stone-900">
                            {row.medianMinutes} min
                          </td>
                          <td className="py-2 px-3">{row.leadsCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="w-full overflow-hidden">
                  {data.charts.responseTimeTrend.length === 0 ? (
                    <div className="p-8 text-center text-xs text-stone-400">
                      No response time history in this period.
                    </div>
                  ) : (
                    <ExecutiveResponseTimeTrendSvg data={data.charts.responseTimeTrend} />
                  )}
                </div>
              )}
            </div>

            {/* Handoff Reasons Summary */}
            <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <h2 className="text-base font-semibold text-stone-900 mb-2">
                Handoff Trigger Summary
              </h2>
              <p className="text-xs text-stone-500 mb-4">
                Enquiries transferred to your personal attention categorized by customer intent.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(data.summary.handoffsByReason).map(([reason, count]) => (
                  <div
                    key={reason}
                    className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-center"
                  >
                    <div className="text-[11px] text-stone-500 uppercase tracking-wider capitalize">
                      {reason.replace(/_/g, " ")}
                    </div>
                    <div className="text-xl font-bold font-serif text-stone-900 mt-1">
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

/**
 * Pure Responsive SVG Line Chart for Daily Median Response Latency
 */
function ExecutiveResponseTimeTrendSvg({
  data,
}: {
  data: Array<{ date: string; medianMinutes: number; leadsCount: number }>;
}) {
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const width = 600;

  const maxVal = Math.max(15, ...data.map((d) => d.medianMinutes));
  const points = data.map((d, i) => {
    const x =
      paddingLeft +
      (i / Math.max(1, data.length - 1)) * (width - paddingLeft - paddingRight);
    const y =
      height -
      paddingBottom -
      (d.medianMinutes / maxVal) * (height - paddingTop - paddingBottom);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-44 text-stone-600 select-none"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y =
            height -
            paddingBottom -
            ratio * (height - paddingTop - paddingBottom);
          const label = Math.round(ratio * maxVal);
          return (
            <g key={ratio}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#E7E5E4"
                strokeDasharray="3 3"
              />
              <text
                x={paddingLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-stone-400 font-mono"
              >
                {label}m
              </text>
            </g>
          );
        })}

        {/* 5-minute target guideline */}
        {5 <= maxVal && (
          <g>
            <line
              x1={paddingLeft}
              y1={
                height -
                paddingBottom -
                (5 / maxVal) * (height - paddingTop - paddingBottom)
              }
              x2={width - paddingRight}
              y2={
                height -
                paddingBottom -
                (5 / maxVal) * (height - paddingTop - paddingBottom)
              }
              stroke="#059669"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <text
              x={width - paddingRight}
              y={
                height -
                paddingBottom -
                (5 / maxVal) * (height - paddingTop - paddingBottom) -
                4
              }
              textAnchor="end"
              className="text-[8px] fill-emerald-700 font-semibold"
            >
              5m SLA Target
            </text>
          </g>
        )}

        {/* Trend line */}
        {points.length > 1 && (
          <path
            d={pathD}
            fill="none"
            stroke="#1F4E3D"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data point circles */}
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="3.5"
            className="fill-white stroke-[#1F4E3D] stroke-[2]"
          >
            <title>{`${pt.date}: ${pt.medianMinutes}m (${pt.leadsCount} enquiries)`}</title>
          </circle>
        ))}

        {/* X Axis dates */}
        {points.length > 0 && (
          <>
            <text
              x={points[0].x}
              y={height - 10}
              textAnchor="start"
              className="text-[9px] fill-stone-400 font-mono"
            >
              {points[0].date}
            </text>
            <text
              x={points[points.length - 1].x}
              y={height - 10}
              textAnchor="end"
              className="text-[9px] fill-stone-400 font-mono"
            >
              {points[points.length - 1].date}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
