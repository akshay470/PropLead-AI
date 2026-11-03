"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";

interface HandoffItem {
  id: string;
  reason: "buyer_requested" | "missing_fact" | "high_intent" | "guardrail" | "error" | string;
  status: "open" | "contacted" | "resolved" | string;
  summary: string;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  lead: {
    id: string;
    name: string;
    leadCode: string;
    phone: string;
    status: string;
    wants: string | null;
    optedOut: boolean;
    consentGiven: boolean;
    visitStatus: string;
  };
  project: {
    id: string | null;
    name: string;
    location: string | null;
  };
  executive: {
    id: string;
    name: string;
  };
  conversationId: string | null;
}

const REASON_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  buyer_requested: {
    label: "Buyer Requested",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  missing_fact: {
    label: "Missing Fact",
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  high_intent: {
    label: "High Intent",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  guardrail: {
    label: "Compliance Guardrail",
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
  },
  error: {
    label: "System Fallback",
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
  },
};

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function ExecutiveHandoffsPage() {
  const [handoffs, setHandoffs] = useState<HandoffItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<"open" | "done">("open");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status Update Modal state
  const [activeHandoff, setActiveHandoff] = useState<HandoffItem | null>(null);
  const [actionStatus, setActionStatus] = useState<"contacted" | "resolved">("contacted");
  const [actionNotes, setActionNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchHandoffs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/executive/handoffs?status=${filterStatus}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch handoffs");
      }
      setHandoffs(data.handoffs || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error loading handoffs");
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchHandoffs();
  }, [fetchHandoffs]);

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!activeHandoff) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/executive/handoffs/${activeHandoff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: actionStatus,
          notes: actionNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update handoff");
      }

      // Close modal and refresh list
      setActiveHandoff(null);
      setActionNotes("");
      await fetchHandoffs();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-12">
      {/* Header */}
      <div className="border-b border-[#EBE7DF] bg-white px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#FAF6F0] px-2.5 py-0.5 text-xs font-medium text-[#8C653D] ring-1 ring-[#E5D4BE] ring-inset">
                  Executive Workspace
                </span>
                <span className="text-xs text-[#7A7973]">&bull; Real-time AI Handoff Queue</span>
              </div>
              <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-[#141413] sm:text-3xl">
                Executive Handoff Inbox
              </h1>
              <p className="mt-1 text-xs text-[#7A7973]">
                Prospective buyers requiring personalized consultation, unanswered fact-sheet questions, or compliance follow-up.
              </p>
            </div>

            {/* Quick Links */}
            <div className="flex items-center gap-2">
              <Link
                href="/executive/leads"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] shadow-2xs hover:bg-[#FAF9F6]"
              >
                View Unified Leads
              </Link>
              <Link
                href="/executive/visits"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] shadow-2xs hover:bg-[#FAF9F6]"
              >
                Site Visits Schedule
              </Link>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-6 flex gap-2 border-b border-[#EBE7DF]">
            <button
              onClick={() => setFilterStatus("open")}
              className={`flex min-h-[44px] items-center border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
                filterStatus === "open"
                  ? "border-[#8C653D] text-[#8C653D]"
                  : "border-transparent text-[#7A7973] hover:text-[#141413]"
              }`}
            >
              Open Handoffs
            </button>
            <button
              onClick={() => setFilterStatus("done")}
              className={`flex min-h-[44px] items-center border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
                filterStatus === "done"
                  ? "border-[#8C653D] text-[#8C653D]"
                  : "border-transparent text-[#7A7973] hover:text-[#141413]"
              }`}
            >
              Resolved / Done
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8">
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            {errorMessage}
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 w-full animate-pulse rounded-2xl border border-[#EBE7DF] bg-white" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && handoffs.length === 0 && (
          <div className="rounded-2xl border border-[#EBE7DF] bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FAF6F0] text-[#8C653D]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-3 text-base font-semibold text-[#141413]">
              {filterStatus === "open" ? "No open handoffs right now" : "No resolved handoffs"}
            </h3>
            <p className="mt-1 text-xs text-[#7A7973]">
              {filterStatus === "open"
                ? "All AI chat conversations are running smoothly within verified fact-sheet bounds."
                : "Handoffs you mark resolved will appear here."}
            </p>
          </div>
        )}

        {/* Handoff Cards List */}
        {!isLoading && handoffs.length > 0 && (
          <div className="space-y-4">
            {handoffs.map((handoff) => {
              const badge = REASON_BADGES[handoff.reason] || {
                label: handoff.reason,
                bg: "bg-stone-50",
                text: "text-stone-800",
                border: "border-stone-200",
              };

              let parsedSummary: Record<string, unknown> | null = null;
              try {
                parsedSummary = JSON.parse(handoff.summary);
              } catch {
                parsedSummary = null;
              }

              return (
                <div
                  key={handoff.id}
                  className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-xs transition-shadow hover:shadow-subtle"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs font-mono font-semibold text-[#141413]">
                          {handoff.lead.leadCode}
                        </span>
                        <span className="text-xs text-[#7A7973]">&bull;</span>
                        <span className="text-xs text-[#7A7973]">{formatTimeAgo(handoff.createdAt)}</span>
                        {handoff.lead.optedOut && (
                          <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            Opted Out
                          </span>
                        )}
                        {handoff.lead.visitStatus === "confirmed" && (
                          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                            Visit Booked
                          </span>
                        )}
                      </div>

                      {/* Buyer Name & Project */}
                      <h3 className="mt-2 text-base font-semibold text-[#141413]">
                        {handoff.lead.name}
                      </h3>
                      <p className="text-xs text-[#7A7973]">
                        {handoff.project.name} &bull; {handoff.lead.wants || "Interested Buyer"} &bull;{" "}
                        <span className="font-mono">{formatPhoneDisplay(handoff.lead.phone)}</span>
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/executive/leads/${handoff.lead.id}`}
                        className="inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-3.5 py-2 text-xs font-medium text-white shadow-2xs hover:bg-[#704E2D] focus:outline-hidden focus:ring-2 focus:ring-[#8C653D]"
                      >
                        View Lead &amp; Chat
                      </Link>
                      {handoff.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveHandoff(handoff);
                            setActionStatus(handoff.status === "contacted" ? "resolved" : "contacted");
                            setActionNotes(handoff.notes || "");
                          }}
                          className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3.5 py-2 text-xs font-medium text-[#575651] hover:bg-[#F4F2EC]"
                        >
                          {handoff.status === "open" ? "Mark Contacted" : "Resolve"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary / Notes Box */}
                  <div className="mt-3 rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-3 text-xs">
                    {parsedSummary ? (
                      <div className="space-y-1.5 text-[#575651]">
                        {Boolean(parsedSummary.sentiment) && (
                          <p>
                            <strong>Sentiment:</strong> {String(parsedSummary.sentiment)}
                          </p>
                        )}
                        {Array.isArray(parsedSummary.openQuestions) && parsedSummary.openQuestions.length > 0 && (
                          <p className="text-amber-900">
                            <strong>Unanswered Questions:</strong> {parsedSummary.openQuestions.join("; ")}
                          </p>
                        )}
                        {Boolean(parsedSummary.recommendedNextAction) && (
                          <p className="text-[#8C653D]">
                            <strong>Recommended Action:</strong> {String(parsedSummary.recommendedNextAction)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[#575651]">{handoff.summary}</p>
                    )}

                    {handoff.notes && (
                      <p className="mt-2 border-t border-[#EBE7DF] pt-2 text-[11px] text-[#7A7973]">
                        <strong>Executive Note:</strong> {handoff.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Update Status Modal */}
      {activeHandoff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#141413]">
              Update Handoff: {activeHandoff.lead.name}
            </h3>
            <p className="mt-1 text-xs text-[#7A7973]">
              Record outcome or resolution notes for this lead handoff.
            </p>

            <form onSubmit={handleUpdateStatus} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#141413]">New Status</label>
                <select
                  value={actionStatus}
                  onChange={(e) => setActionStatus(e.target.value as "contacted" | "resolved")}
                  className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-[#EBE7DF] bg-white px-3 py-2 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-hidden"
                >
                  <option value="contacted">Contacted (Called / Emailed)</option>
                  <option value="resolved">Resolved (Completed consultation / closed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141413]">
                  Executive Note <span className="text-[#7A7973]">(Optional)</span>
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g. Spoke with buyer, clarified possession schedule and confirmed 3 BHK interest..."
                  rows={3}
                  className="mt-1.5 block w-full rounded-xl border border-[#EBE7DF] p-3 text-xs text-[#141413] placeholder-[#AFAEA7] focus:border-[#8C653D] focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveHandoff(null)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#575651] hover:bg-[#FAF9F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-4 py-2 text-xs font-medium text-white hover:bg-[#704E2D]"
                >
                  {isUpdating ? "Saving..." : "Save Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
