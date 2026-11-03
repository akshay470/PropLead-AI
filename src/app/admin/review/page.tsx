"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface MessageItem {
  id: string;
  role: string;
  content: string;
  flagged: boolean;
  flagReason: string | null;
  createdAt: string;
}

interface FlaggedConversation {
  id: string;
  leadId: string;
  projectId: string | null;
  flagReason: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  lead: {
    id: string;
    name: string;
    leadCode: string;
    phone: string;
    wants: string | null;
  };
  project: {
    id: string | null;
    name: string;
  };
  handoff: {
    id: string;
    reason: string;
    summary: string;
    notes: string | null;
    executiveId: string;
    executiveName: string;
  } | null;
  offendingMessage: MessageItem | null;
  lastUserQuestion: string;
  messages: MessageItem[];
}

interface DigestMetrics {
  flaggedToday: number;
  reviewedToday: number;
  pendingReview: number;
}

interface ExecutiveUser {
  id: string;
  name: string;
}

export default function AdminReviewQueuePage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<FlaggedConversation[]>([]);
  const [digest, setDigest] = useState<DigestMetrics>({
    flaggedToday: 0,
    reviewedToday: 0,
    pendingReview: 0,
  });
  const [executives, setExecutives] = useState<ExecutiveUser[]>([]);
  const [filter, setFilter] = useState<"pending" | "reviewed" | "all">("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review modal state
  const [reviewingConv, setReviewingConv] = useState<FlaggedConversation | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Reassign modal state
  const [reassigningConv, setReassigningConv] = useState<FlaggedConversation | null>(null);
  const [selectedExecId, setSelectedExecId] = useState("");
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  // Expanded transcripts
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [reviewRes, execRes] = await Promise.all([
        fetch(`/api/admin/review?filter=${filter}`),
        fetch("/api/executives"),
      ]);

      if (reviewRes.status === 403 || reviewRes.status === 401) {
        setErrorMessage("Access Denied: Only Sales Head administrators can access this review queue.");
        setIsLoading(false);
        return;
      }

      const reviewData = await reviewRes.json();
      if (!reviewRes.ok || !reviewData.success) {
        throw new Error(reviewData.error || "Failed to load review queue");
      }

      setConversations(reviewData.conversations || []);
      setDigest(
        reviewData.digest || { flaggedToday: 0, reviewedToday: 0, pendingReview: 0 }
      );

      if (execRes.ok) {
        const execData = await execRes.json();
        if (execData.success) setExecutives(execData.executives || []);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error loading queue");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mark reviewed
  async function handleMarkReviewed(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewingConv) return;
    setIsSubmittingReview(true);

    try {
      const res = await fetch(`/api/admin/review/${reviewingConv.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes: reviewNotes.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to mark reviewed");
      }

      setReviewingConv(null);
      setReviewNotes("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating review");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  // Reassign executive
  async function handleReassign(e: React.FormEvent) {
    e.preventDefault();
    if (!reassigningConv || !selectedExecId) return;
    setIsSubmittingReassign(true);

    try {
      const res = await fetch(`/api/admin/review/${reassigningConv.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newExecutiveId: selectedExecId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to reassign executive");
      }

      setReassigningConv(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error reassigning executive");
    } finally {
      setIsSubmittingReassign(false);
    }
  }

  // Add gap to fact sheet
  function handleAddToFactSheet(conv: FlaggedConversation) {
    const question = conv.lastUserQuestion || conv.offendingMessage?.content || "";
    const pId = conv.projectId || "";
    router.push(
      `/admin/facts?projectId=${pId}&question=${encodeURIComponent(question)}&category=Unanswered_Queries`
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16">
      {/* 1. Header & Navigation */}
      <div className="border-b border-[#EBE7DF] bg-white px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 ring-inset">
                  Sales Head Admin
                </span>
                <span className="text-xs text-[#7A7973]">&bull; Quality &amp; Compliance Oversight</span>
              </div>
              <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#141413] sm:text-3xl">
                Flagged Chat Review Queue
              </h1>
              <p className="mt-1 text-xs text-[#7A7973]">
                Daily audit of AI conversations flagged for price guardrail violations, unanswered fact gaps, or customer escalation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/facts"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-4 py-2 text-xs font-medium text-white shadow-2xs hover:bg-[#704E2D]"
              >
                Fact Sheet Editor
              </Link>
              <Link
                href="/executive/leads"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] hover:bg-[#FAF9F6]"
              >
                All Leads
              </Link>
            </div>
          </div>

          {/* 2. Daily Digest Metrics */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-4">
              <span className="text-xs font-medium text-[#7A7973]">Flagged Today</span>
              <div className="mt-1 text-2xl font-bold text-[#141413]">{digest.flaggedToday}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <span className="text-xs font-medium text-emerald-800">Reviewed Today</span>
              <div className="mt-1 text-2xl font-bold text-emerald-900">{digest.reviewedToday}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <span className="text-xs font-medium text-amber-800">Pending Review</span>
              <div className="mt-1 text-2xl font-bold text-amber-900">{digest.pendingReview}</div>
            </div>
          </div>

          {/* 3. Filter Tabs */}
          <div className="mt-6 flex gap-2 border-b border-[#EBE7DF]">
            <button
              onClick={() => setFilter("pending")}
              className={`flex min-h-[44px] items-center border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
                filter === "pending"
                  ? "border-[#8C653D] text-[#8C653D]"
                  : "border-transparent text-[#7A7973] hover:text-[#141413]"
              }`}
            >
              Pending Audit ({digest.pendingReview})
            </button>
            <button
              onClick={() => setFilter("reviewed")}
              className={`flex min-h-[44px] items-center border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
                filter === "reviewed"
                  ? "border-[#8C653D] text-[#8C653D]"
                  : "border-transparent text-[#7A7973] hover:text-[#141413]"
              }`}
            >
              Reviewed History
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`flex min-h-[44px] items-center border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "border-[#8C653D] text-[#8C653D]"
                  : "border-transparent text-[#7A7973] hover:text-[#141413]"
              }`}
            >
              All Flagged
            </button>
          </div>
        </div>
      </div>

      {/* 4. Queue Content */}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8">
        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-6 text-sm text-red-900 shadow-xs">
            <h3 className="font-semibold text-red-950">Unauthorized Access</h3>
            <p className="mt-1 text-xs text-red-800">{errorMessage}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 w-full animate-pulse rounded-2xl border border-[#EBE7DF] bg-white" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !errorMessage && conversations.length === 0 && (
          <div className="rounded-2xl border border-[#EBE7DF] bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-3 text-base font-semibold text-[#141413]">
              {filter === "pending" ? "Queue is clear!" : "No conversations found"}
            </h3>
            <p className="mt-1 text-xs text-[#7A7973]">
              {filter === "pending"
                ? "No pending flagged conversations requiring Sales Head review. All guardrails and tools running smoothly."
                : "No conversations match the current filter selection."}
            </p>
          </div>
        )}

        {/* Conversation Cards */}
        {!isLoading && !errorMessage && conversations.length > 0 && (
          <div className="space-y-6">
            {conversations.map((conv) => {
              const isExpanded = !!expandedTranscripts[conv.id];

              return (
                <div
                  key={conv.id}
                  className="rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xs transition hover:shadow-subtle"
                >
                  {/* Card Header */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                          {conv.flagReason.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[#141413]">
                          {conv.lead.leadCode}
                        </span>
                        <span className="text-xs text-[#7A7973]">&bull;</span>
                        <span className="text-xs text-[#7A7973]">
                          {new Date(conv.createdAt).toLocaleString()}
                        </span>
                        {conv.reviewedAt && (
                          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                            Reviewed
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 text-base font-bold text-[#141413]">
                        {conv.lead.name} &bull; {conv.project.name}
                      </h3>
                      <p className="text-xs text-[#7A7973]">
                        {conv.lead.wants || "Interested Buyer"} &bull; Assigned to:{" "}
                        <strong>{conv.handoff?.executiveName || "Unassigned"}</strong>
                      </p>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      {!conv.reviewedAt && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewingConv(conv);
                            setReviewNotes("");
                          }}
                          className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800"
                        >
                          Mark Reviewed
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setReassigningConv(conv);
                          setSelectedExecId(conv.handoff?.executiveId || "");
                        }}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3.5 py-2 text-xs font-medium text-[#141413] hover:bg-[#F4F2EC]"
                      >
                        Reassign Exec
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToFactSheet(conv)}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-[#D4B999] bg-[#FAF6F0] px-3.5 py-2 text-xs font-medium text-[#704E2D] hover:bg-[#F4ECE0]"
                      >
                        Add to Fact Sheet
                      </button>

                      <Link
                        href={`/executive/leads/${conv.leadId}`}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-3 py-2 text-xs text-[#7A7973] hover:text-[#141413]"
                      >
                        Lead View
                      </Link>
                    </div>
                  </div>

                  {/* Highlighted Offending or Unanswered Message */}
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
                    <span className="text-[11px] font-bold text-red-900 uppercase tracking-wider block">
                      Offending / Flagged Trigger:
                    </span>
                    <p className="mt-1 text-xs font-medium text-red-950">
                      {conv.offendingMessage?.content || conv.lastUserQuestion || "Automated guardrail intervention"}
                    </p>
                    {conv.offendingMessage?.flagReason && (
                      <p className="mt-1 text-[11px] text-red-700">
                        Reason: {conv.offendingMessage.flagReason}
                      </p>
                    )}
                  </div>

                  {/* Review Notes (if already reviewed) */}
                  {conv.reviewNotes && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 text-xs text-emerald-950">
                      <strong>Sales Head Audit Note:</strong> {conv.reviewNotes}
                    </div>
                  )}

                  {/* Transcript Toggle */}
                  <div className="mt-4 border-t border-[#EBE7DF] pt-3 flex items-center justify-between">
                    <span className="text-xs text-[#7A7973]">
                      {conv.messages.length} messages in conversation
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleTranscript(conv.id)}
                      className="text-xs font-medium text-[#8C653D] hover:underline"
                    >
                      {isExpanded ? "Hide Full Transcript" : "View Full Transcript"}
                    </button>
                  </div>

                  {/* Expanded Full Transcript */}
                  {isExpanded && (
                    <div className="mt-3 rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-4 space-y-2 max-h-96 overflow-y-auto">
                      {conv.messages.map((m) => {
                        const isUser = m.role === "user";
                        return (
                          <div
                            key={m.id}
                            className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                              m.flagged
                                ? "border border-red-300 bg-red-50 text-red-950"
                                : isUser
                                ? "bg-white border border-[#EBE7DF] text-[#141413]"
                                : "bg-[#F4F2EC] text-[#575651]"
                            }`}
                          >
                            <span className="font-semibold block text-[11px] text-[#7A7973]">
                              {isUser ? conv.lead.name : "PropLead AI Assistant"}{" "}
                              {m.flagged && <span className="text-red-700 font-bold">[FLAGGED]</span>}
                            </span>
                            <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mark Reviewed Modal */}
      {reviewingConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#141413]">
              Mark Reviewed: {reviewingConv.lead.name}
            </h3>
            <p className="mt-1 text-xs text-[#7A7973]">
              Document your sales head review findings or resolution steps.
            </p>

            <form onSubmit={handleMarkReviewed} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#141413]">Audit Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Guardrail correctly caught off-book discount. Followed up with executive to ensure price range adherence..."
                  rows={4}
                  required
                  className="mt-1.5 block w-full rounded-xl border border-[#EBE7DF] p-3 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingConv(null)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#575651]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
                >
                  {isSubmittingReview ? "Saving..." : "Approve & Mark Reviewed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Executive Modal */}
      {reassigningConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#141413]">
              Reassign Lead: {reassigningConv.lead.name}
            </h3>
            <p className="mt-1 text-xs text-[#7A7973]">
              Select a new sales executive to take over consultation for this flagged conversation.
            </p>

            <form onSubmit={handleReassign} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#141413]">Select Executive</label>
                <select
                  value={selectedExecId}
                  onChange={(e) => setSelectedExecId(e.target.value)}
                  required
                  className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-[#EBE7DF] bg-white px-3 py-2 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-hidden"
                >
                  <option value="">Select an executive...</option>
                  {executives.map((exec) => (
                    <option key={exec.id} value={exec.id}>
                      {exec.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassigningConv(null)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#575651]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReassign || !selectedExecId}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-4 py-2 text-xs font-medium text-white hover:bg-[#704E2D]"
                >
                  {isSubmittingReassign ? "Reassigning..." : "Confirm Reassignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
