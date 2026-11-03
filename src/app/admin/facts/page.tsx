"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface FactEntry {
  id: string;
  projectId: string;
  projectName: string;
  category: string;
  questionKey: string;
  answerText: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  locationName: string;
  reraNumber: string;
}

interface GuardrailViolation {
  error: string;
  reason?: string;
  violatingSnippet?: string;
  guidance?: string;
}

const COMMON_CATEGORIES = [
  "pricing_and_unit_types",
  "amenities",
  "location",
  "possession",
  "rera",
  "visit_timings_and_guidelines",
  "parking",
  "loan_assistance",
  "contact_policy",
  "Unanswered_Queries",
];

function FactSheetContent() {
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId") || "";
  const queryQuestion = searchParams.get("question") || "";
  const queryCategory = searchParams.get("category") || "";

  const [facts, setFacts] = useState<FactEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(queryProjectId || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add / Edit Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingFact, setEditingFact] = useState<FactEntry | null>(null);

  // Form states
  const [formProjectId, setFormProjectId] = useState(queryProjectId || "");
  const [formCategory, setFormCategory] = useState(queryCategory || "pricing_and_unit_types");
  const [formQuestionKey, setFormQuestionKey] = useState("");
  const [formAnswerText, setFormAnswerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guardrailError, setGuardrailError] = useState<GuardrailViolation | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.projects) {
            setProjects(json.projects);
            if (!formProjectId && json.projects.length > 0) {
              setFormProjectId(json.projects[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    }
    loadProjects();
  }, [formProjectId]);

  // Load facts
  const loadFacts = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const url =
        selectedProjectId && selectedProjectId !== "all"
          ? `/api/admin/facts?projectId=${selectedProjectId}`
          : "/api/admin/facts";

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 403) {
          throw new Error("Access restricted: Sales Head admin login required.");
        }
        throw new Error(json.error || "Failed to load facts");
      }

      setFacts(json.facts || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error loading fact sheet");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadFacts();
  }, [loadFacts]);

  // Handle prefill from query params (e.g. from /admin/review "Add to Fact Sheet")
  useEffect(() => {
    if (queryQuestion || queryCategory || queryProjectId) {
      if (queryProjectId) setFormProjectId(queryProjectId);
      if (queryCategory) setFormCategory(queryCategory);
      if (queryQuestion) {
        // Derive clean question key
        const slug = queryQuestion
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 50);
        setFormQuestionKey(slug);
      }
      setIsAddOpen(true);
    }
  }, [queryQuestion, queryCategory, queryProjectId]);

  // Reset form
  function resetForm() {
    setFormProjectId(projects[0]?.id || "");
    setFormCategory("pricing_and_unit_types");
    setFormQuestionKey("");
    setFormAnswerText("");
    setGuardrailError(null);
  }

  // Handle Create Fact
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setGuardrailError(null);

    try {
      const res = await fetch("/api/admin/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: formProjectId,
          category: formCategory.trim(),
          questionKey: formQuestionKey.trim(),
          answerText: formAnswerText.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.reason || json.violatingSnippet) {
          setGuardrailError({
            error: json.error || "Compliance violation",
            reason: json.reason,
            violatingSnippet: json.violatingSnippet,
            guidance: json.guidance,
          });
          return;
        }
        throw new Error(json.error || "Failed to create fact");
      }

      setIsAddOpen(false);
      resetForm();
      await loadFacts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving fact entry");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Edit Fact
  function openEdit(fact: FactEntry) {
    setEditingFact(fact);
    setFormCategory(fact.category);
    setFormQuestionKey(fact.questionKey);
    setFormAnswerText(fact.answerText);
    setGuardrailError(null);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingFact) return;
    setIsSubmitting(true);
    setGuardrailError(null);

    try {
      const res = await fetch(`/api/admin/facts/${editingFact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formCategory.trim(),
          questionKey: formQuestionKey.trim(),
          answerText: formAnswerText.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.reason || json.violatingSnippet) {
          setGuardrailError({
            error: json.error || "Compliance violation",
            reason: json.reason,
            violatingSnippet: json.violatingSnippet,
            guidance: json.guidance,
          });
          return;
        }
        throw new Error(json.error || "Failed to update fact");
      }

      setEditingFact(null);
      resetForm();
      await loadFacts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating fact entry");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Delete Fact
  async function handleDelete(fact: FactEntry) {
    const confirmed = window.confirm(
      `Delete entry "${fact.questionKey}" for ${fact.projectName}?\n\nThe AI assistant will no longer answer this question.`
    );
    if (!confirmed) return;

    setDeletingId(fact.id);
    try {
      const res = await fetch(`/api/admin/facts/${fact.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete fact entry");
      }
      await loadFacts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting fact entry");
    } finally {
      setDeletingId(null);
    }
  }

  // Filtered facts list
  const filteredFacts = facts.filter((f) => {
    if (selectedCategory !== "all" && f.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchQ = f.questionKey.toLowerCase().includes(query);
      const matchA = f.answerText.toLowerCase().includes(query);
      const matchC = f.category.toLowerCase().includes(query);
      if (!matchQ && !matchA && !matchC) return false;
    }
    return true;
  });

  // Extract distinct categories from facts
  const existingCategories = Array.from(new Set(facts.map((f) => f.category))).sort();

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16">
      {/* 1. Header & Navigation */}
      <div className="border-b border-[#EBE7DF] bg-white px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
                  Sales Head Admin
                </span>
                <span className="text-xs text-[#7A7973]">&bull; Knowledge Base Ground Truth</span>
              </div>
              <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#141413] sm:text-3xl">
                Fact Sheet Editor
              </h1>
              <p className="mt-1 text-xs text-[#7A7973]">
                The AI assistant answers buyer questions strictly from this fact sheet. Strict RERA pricing guardrails protect every entry.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/review"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] hover:bg-[#FAF9F6]"
              >
                Flagged Review Queue
              </Link>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsAddOpen(true);
                }}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-4 py-2 text-xs font-medium text-white shadow-2xs hover:bg-[#704E2D]"
              >
                + Add Fact Entry
              </button>
            </div>
          </div>

          {/* 2. Filters & Search Bar */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {/* Project filter */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="min-h-[44px] rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3 py-2 text-xs font-medium text-[#141413] focus:border-[#8C653D] focus:outline-none"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.locationName})
                  </option>
                ))}
              </select>

              {/* Category filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="min-h-[44px] rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3 py-2 text-xs font-medium text-[#141413] focus:border-[#8C653D] focus:outline-none"
              >
                <option value="all">All Categories</option>
                {existingCategories.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Keyword search */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search question key or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3 py-2 text-xs text-[#141413] placeholder-[#7A7973] focus:border-[#8C653D] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-[#7A7973] hover:text-[#141413]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {errorMsg ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <h3 className="text-sm font-semibold text-red-900">Authorization / Access Notice</h3>
            <p className="mt-1 text-xs text-red-700">{errorMsg}</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/login?redirect=/admin/facts"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                Sign In as Admin
              </Link>
              <button
                type="button"
                onClick={loadFacts}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-red-200 bg-white px-4 py-2 text-xs text-red-800 hover:bg-red-50"
              >
                Retry
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="py-16 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#8C653D] border-t-transparent" />
            <p className="mt-2 text-xs text-[#7A7973]">Loading knowledge base entries...</p>
          </div>
        ) : filteredFacts.length === 0 ? (
          <div className="rounded-2xl border border-[#EBE7DF] bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FAF6F0] text-[#8C653D]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-medium text-[#141413]">No fact sheet entries found</h3>
            <p className="mt-1 text-xs text-[#7A7973]">
              {searchQuery || selectedCategory !== "all"
                ? "Try clearing your filters or search terms."
                : "No fact entries exist for this selection yet."}
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsAddOpen(true);
                }}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-4 py-2 text-xs font-medium text-white shadow-2xs hover:bg-[#704E2D]"
              >
                + Add First Fact Entry
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#7A7973] px-1">
              <span>Showing {filteredFacts.length} fact entries</span>
              <span>Updated automatically in AI conversation memory</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredFacts.map((fact) => (
                <div
                  key={fact.id}
                  className="rounded-2xl border border-[#EBE7DF] bg-white p-5 shadow-2xs transition-shadow hover:shadow-xs"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-[#FAF6F0] px-2 py-0.5 text-xs font-medium text-[#704E2D]">
                          {fact.projectName}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                          {fact.category.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-[#7A7973]">
                          Updated {new Date(fact.updatedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <h3 className="mt-2 font-mono text-sm font-semibold text-[#141413]">
                        {fact.questionKey}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => openEdit(fact)}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3.5 py-1.5 text-xs font-medium text-[#141413] hover:bg-[#F4F2EC]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === fact.id}
                        onClick={() => handleDelete(fact)}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === fact.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#F2EFE9] bg-[#FAF9F6] p-4 text-xs leading-relaxed text-[#2C2B29]">
                    <p className="whitespace-pre-line">{fact.answerText}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADD FACT MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EBE7DF] pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#141413]">Add Fact Sheet Entry</h3>
                <p className="text-xs text-[#7A7973]">Ground truth for AI responses</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-lg leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Guardrail Violation Alert */}
            {guardrailError && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-950">
                <div className="font-semibold text-red-900 flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-red-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {guardrailError.error}
                </div>
                {guardrailError.violatingSnippet && (
                  <p className="mt-1 font-mono text-[11px] bg-red-100/70 p-1.5 rounded text-red-900">
                    Snippet: &quot;{guardrailError.violatingSnippet}&quot;
                  </p>
                )}
                {guardrailError.reason && (
                  <p className="mt-1 text-[11px] text-red-800">
                    Violation rule: <span className="font-mono font-medium">{guardrailError.reason}</span>
                  </p>
                )}
                <p className="mt-2 text-[11px] text-red-750 border-t border-red-200/60 pt-2 leading-relaxed">
                  {guardrailError.guidance ||
                    "Fact sheet entries must only cite approved price ranges per BHK (Rs 65L - Rs 1.20Cr). Exact unit prices, cash discounts, negotiation language, or unapproved schemes are strictly forbidden."}
                </p>
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#141413]">Project</label>
                <select
                  required
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3 py-2 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.locationName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141413]">Category</label>
                <input
                  type="text"
                  required
                  list="categories-list"
                  placeholder="e.g. pricing_and_unit_types"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3 py-2 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-none"
                />
                <datalist id="categories-list">
                  {COMMON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141413]">
                  Question Key (identifier / query tag)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. swimming_pool_timings or 3_bhk_price"
                  value={formQuestionKey}
                  onChange={(e) => setFormQuestionKey(e.target.value)}
                  className="mt-1 w-full min-h-[44px] font-mono rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3 py-2 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#141413]">
                    Answer Text (Authoritative Response)
                  </label>
                  <span className="text-[11px] text-[#8C653D]">RERA Compliance Active</span>
                </div>
                <textarea
                  required
                  rows={5}
                  placeholder="Enter the factual statement. Note: Price ranges ONLY (e.g. Rs 65 Lakh to Rs 76 Lakh). No single exact figures or discounts."
                  value={formAnswerText}
                  onChange={(e) => setFormAnswerText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-3 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#EBE7DF] pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] hover:bg-[#FAF9F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-5 py-2 text-xs font-medium text-white shadow-2xs hover:bg-[#704E2D] disabled:opacity-50"
                >
                  {isSubmitting ? "Saving Entry..." : "Save to Fact Sheet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FACT MODAL */}
      {editingFact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EBE7DF] pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#141413]">Edit Fact Sheet Entry</h3>
                <p className="text-xs text-[#7A7973]">{editingFact.projectName}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingFact(null)}
                className="text-stone-400 hover:text-stone-600 text-lg leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Guardrail Violation Alert */}
            {guardrailError && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-950">
                <div className="font-semibold text-red-900 flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-red-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {guardrailError.error}
                </div>
                {guardrailError.violatingSnippet && (
                  <p className="mt-1 font-mono text-[11px] bg-red-100/70 p-1.5 rounded text-red-900">
                    Snippet: &quot;{guardrailError.violatingSnippet}&quot;
                  </p>
                )}
                {guardrailError.reason && (
                  <p className="mt-1 text-[11px] text-red-800">
                    Violation rule: <span className="font-mono font-medium">{guardrailError.reason}</span>
                  </p>
                )}
                <p className="mt-2 text-[11px] text-red-750 border-t border-red-200/60 pt-2 leading-relaxed">
                  {guardrailError.guidance ||
                    "Fact sheet entries must only cite approved price ranges per BHK (Rs 65L - Rs 1.20Cr). Exact unit prices, cash discounts, negotiation language, or unapproved schemes are strictly forbidden."}
                </p>
              </div>
            )}

            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#141413]">Category</label>
                <input
                  type="text"
                  required
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3 py-2 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141413]">Question Key</label>
                <input
                  type="text"
                  required
                  value={formQuestionKey}
                  onChange={(e) => setFormQuestionKey(e.target.value)}
                  className="mt-1 w-full min-h-[44px] font-mono rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] px-3 py-2 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141413]">Answer Text</label>
                <textarea
                  required
                  rows={5}
                  value={formAnswerText}
                  onChange={(e) => setFormAnswerText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-3 text-xs text-[#141413] focus:border-[#8C653D] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#EBE7DF] pt-4">
                <button
                  type="button"
                  onClick={() => setEditingFact(null)}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-[#EBE7DF] bg-white px-4 py-2 text-xs font-medium text-[#141413] hover:bg-[#FAF9F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-5 py-2 text-xs font-medium text-white shadow-2xs hover:bg-[#704E2D] disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : "Update Fact Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminFactsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F5] p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#8C653D] border-t-transparent" />
          <p className="mt-2 text-xs text-[#7A7973]">Loading Fact Sheet Editor...</p>
        </div>
      }
    >
      <FactSheetContent />
    </Suspense>
  );
}
