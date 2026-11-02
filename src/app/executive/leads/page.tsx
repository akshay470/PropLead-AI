"use client";

import { useState, useEffect, useCallback } from "react";
import { formatPhoneDisplay } from "@/lib/phone";

interface LeadItem {
  id: string;
  leadCode: string;
  name: string;
  phoneE164: string;
  email: string | null;
  source: "property_portal" | "social_media_ad" | "website" | "hoarding_call";
  projectId: string | null;
  projectName: string | null;
  wants: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  language: string;
  consentGiven: boolean;
  optedOut: boolean;
  status: "new" | "contacted" | "qualified" | "visit_scheduled" | "visited" | "lost";
  assignedExecutiveId: string | null;
  assignedExecutiveName: string | null;
  duplicateOfId: string | null;
  canonicalLeadCode: string | null;
  canonicalLeadName: string | null;
  firstResponseAt: string | null;
  createdAt: string;
}

interface Executive {
  id: string;
  name: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
}

export default function UnifiedLeadListPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [duplicateFilter, setDuplicateFilter] = useState<"all" | "exclude" | "only">("all");

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  // Fetch executives & projects on mount
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [execRes, projRes] = await Promise.all([
          fetch("/api/executives"),
          fetch("/api/projects"),
        ]);

        if (execRes.ok) {
          const data = await execRes.json();
          if (data.success) setExecutives(data.executives || []);
        }

        if (projRes.ok) {
          const data = await projRes.json();
          if (data.success) setProjects(data.projects || []);
        }
      } catch (err) {
        console.error("Failed to load metadata:", err);
      }
    }

    loadMetadata();
  }, []);

  // Fetch leads with active filters
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (sourceFilter) params.set("source", sourceFilter);
      if (projectFilter) params.set("project", projectFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (duplicateFilter !== "all") params.set("duplicates", duplicateFilter);
      params.set("limit", "100");

      const response = await fetch(`/api/leads?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load leads list");
      }

      setLeads(data.leads || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error fetching leads");
    } finally {
      setIsLoading(false);
    }
  }, [search, sourceFilter, projectFilter, statusFilter, duplicateFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Handle Executive Assignment
  async function handleAssign(leadId: string, executiveId: string | null) {
    setUpdatingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executiveId: executiveId || null }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to assign executive");
      }

      // Optimistic update
      const assignedExec = executives.find((e) => e.id === executiveId);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                assignedExecutiveId: executiveId,
                assignedExecutiveName: assignedExec?.name || null,
              }
            : l
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setUpdatingLeadId(null);
    }
  }

  // Handle Unlink Duplicate
  async function handleUnlinkDuplicate(leadId: string) {
    setUpdatingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/duplicate/unlink`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to unlink duplicate");
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                duplicateOfId: null,
                canonicalLeadCode: null,
                canonicalLeadName: null,
              }
            : l
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to unlink duplicate");
    } finally {
      setUpdatingLeadId(null);
    }
  }

  // Format Response Time
  function formatResponseTime(createdAtStr: string, firstResponseAtStr: string | null) {
    if (!firstResponseAtStr) {
      const elapsedHours = (Date.now() - new Date(createdAtStr).getTime()) / (1000 * 3600);
      if (elapsedHours > 48) {
        return (
          <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
            Unreached (&gt;48h)
          </span>
        );
      }
      return <span className="text-xs text-ink-400 italic">Pending response</span>;
    }

    const diffSeconds =
      (new Date(firstResponseAtStr).getTime() - new Date(createdAtStr).getTime()) / 1000;

    if (diffSeconds < 120) {
      return (
        <span className="inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
          {Math.max(1, Math.round(diffSeconds))}s (Fast)
        </span>
      );
    }

    if (diffSeconds < 3600) {
      return (
        <span className="text-xs text-ink-700 font-medium">
          {Math.round(diffSeconds / 60)} min
        </span>
      );
    }

    return (
      <span className="text-xs text-amber-800 font-medium">
        {(diffSeconds / 3600).toFixed(1)} hrs
      </span>
    );
  }

  // Format Source Badge
  function renderSourceBadge(source: LeadItem["source"]) {
    switch (source) {
      case "property_portal":
        return (
          <span className="inline-flex items-center rounded border border-stone-300 bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
            Portal
          </span>
        );
      case "social_media_ad":
        return (
          <span className="inline-flex items-center rounded border border-amber-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">
            Social Ad
          </span>
        );
      case "website":
        return (
          <span className="inline-flex items-center rounded border border-surface-300 bg-surface-200 px-2 py-0.5 text-[11px] font-medium text-ink-700">
            Website
          </span>
        );
      case "hoarding_call":
        return (
          <span className="inline-flex items-center rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800">
            Hoarding
          </span>
        );
    }
  }

  // Format Status Badge
  function renderStatusPill(status: LeadItem["status"]) {
    switch (status) {
      case "new":
        return (
          <span className="inline-flex items-center rounded-full border border-surface-300 bg-surface-100 px-2.5 py-0.5 text-xs text-ink-600">
            New Lead
          </span>
        );
      case "contacted":
        return (
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            Contacted
          </span>
        );
      case "qualified":
        return (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            Qualified
          </span>
        );
      case "visit_scheduled":
        return (
          <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            Visit Booked
          </span>
        );
      case "visited":
        return (
          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
            Visited
          </span>
        );
      case "lost":
        return (
          <span className="inline-flex items-center rounded-full border border-surface-300 bg-surface-200 px-2.5 py-0.5 text-xs text-ink-400">
            Lost
          </span>
        );
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-600">
            Company A • Sales Pipeline
          </span>
          <h1 className="font-serif text-2xl font-light tracking-tight text-ink-950 sm:text-3xl">
            Unified Leads &amp; Duplicate Queue
          </h1>
          <p className="mt-1 text-xs text-ink-500">
            Centralized intake across property portals, social ads, website, and hoardings with automated deduplication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLeads()}
            className="rounded border border-surface-300 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-surface-200"
          >
            Refresh List
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 rounded-xl border border-surface-300 bg-surface-50 p-4 shadow-subtle">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-medium text-ink-500 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Name, phone, LD code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-surface-300 bg-surface-100 px-2.5 py-1.5 text-xs text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-surface-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">
              Channel Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full rounded border border-surface-300 bg-surface-100 px-2 py-1.5 text-xs text-ink-900 focus:border-brand-500 focus:bg-surface-50 focus:outline-none"
            >
              <option value="">All Sources</option>
              <option value="property_portal">Property Portal</option>
              <option value="social_media_ad">Social Media Ad</option>
              <option value="website">Website Form</option>
              <option value="hoarding_call">Hoarding Call</option>
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">
              Project
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full rounded border border-surface-300 bg-surface-100 px-2 py-1.5 text-xs text-ink-900 focus:border-brand-500 focus:bg-surface-50 focus:outline-none"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Visit Status Filter */}
          <div>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">
              Visit Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded border border-surface-300 bg-surface-100 px-2 py-1.5 text-xs text-ink-900 focus:border-brand-500 focus:bg-surface-50 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="visit_scheduled">Visit Booked</option>
              <option value="visited">Visited</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          {/* Duplicate Mode Filter */}
          <div>
            <label className="block text-[11px] font-medium text-ink-500 mb-1">
              Duplicate View
            </label>
            <select
              value={duplicateFilter}
              onChange={(e) => setDuplicateFilter(e.target.value as "all" | "exclude" | "only")}
              className="w-full rounded border border-surface-300 bg-surface-100 px-2 py-1.5 text-xs text-ink-900 focus:border-brand-500 focus:bg-surface-50 focus:outline-none"
            >
              <option value="all">All Records</option>
              <option value="exclude">Exclude Duplicates</option>
              <option value="only">Only Duplicate Flags</option>
            </select>
          </div>
        </div>

        {/* Clear Filters bar */}
        {(search || sourceFilter || projectFilter || statusFilter || duplicateFilter !== "all") && (
          <div className="mt-3 flex items-center justify-between border-t border-surface-200 pt-3 text-xs">
            <span className="text-ink-500">
              Showing filtered leads ({leads.length} of {totalCount})
            </span>
            <button
              onClick={() => {
                setSearch("");
                setSourceFilter("");
                setProjectFilter("");
                setStatusFilter("");
                setDuplicateFilter("all");
              }}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="mt-6">
        {/* Error State */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="text-xs font-semibold">{errorMessage}</p>
            <button
              onClick={() => fetchLeads()}
              className="mt-3 rounded border border-red-300 bg-surface-50 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !errorMessage && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-xl border border-surface-300 bg-surface-50"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !errorMessage && leads.length === 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-50 p-12 text-center shadow-card">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 font-serif text-lg">
              Ø
            </div>
            <h3 className="mt-4 font-serif text-base font-medium text-ink-900">
              No leads match these filters
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Try adjusting your search criteria, source filters, or duplicate settings.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSourceFilter("");
                setProjectFilter("");
                setStatusFilter("");
                setDuplicateFilter("all");
              }}
              className="mt-4 inline-flex items-center rounded bg-ink-900 px-4 py-2 text-xs font-medium text-surface-50 shadow-subtle hover:bg-ink-800"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Leads Table (Desktop) */}
        {!isLoading && !errorMessage && leads.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-surface-300 bg-surface-50 shadow-subtle">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-300 bg-surface-100/70 text-[11px] uppercase tracking-wider text-ink-500">
                    <th className="px-4 py-3 font-semibold">Lead Code</th>
                    <th className="px-4 py-3 font-semibold">Buyer Name &amp; Contact</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">Project</th>
                    <th className="px-4 py-3 font-semibold">Wants</th>
                    <th className="px-4 py-3 font-semibold">Visit Status</th>
                    <th className="px-4 py-3 font-semibold">Assigned Executive</th>
                    <th className="px-4 py-3 font-semibold">Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {leads.map((lead) => {
                    const isDup = Boolean(lead.duplicateOfId);

                    return (
                      <tr
                        key={lead.id}
                        className={`transition hover:bg-surface-100/50 ${
                          isDup ? "bg-amber-50/20" : ""
                        }`}
                      >
                        {/* Lead Code */}
                        <td className="px-4 py-3 font-mono font-medium text-ink-900 whitespace-nowrap">
                          {lead.leadCode}
                        </td>

                        {/* Name & Contact */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink-950">{lead.name}</div>
                          <div className="font-mono text-[11px] text-ink-500">
                            {formatPhoneDisplay(lead.phoneE164)}
                          </div>
                          {lead.optedOut ? (
                            <span className="inline-block mt-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                              Opted Out (STOP)
                            </span>
                          ) : !lead.consentGiven ? (
                            <span className="inline-block mt-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              No DPDP Consent
                            </span>
                          ) : null}

                          {/* Duplicate indicator & actions */}
                          {isDup && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="rounded bg-amber-100/70 border border-amber-300 px-1.5 py-0.5 text-amber-900 font-medium">
                                Duplicate of {lead.canonicalLeadCode || "Original"}
                              </span>
                              <button
                                onClick={() => handleUnlinkDuplicate(lead.id)}
                                disabled={updatingLeadId === lead.id}
                                className="text-[11px] text-ink-500 hover:text-ink-900 underline"
                              >
                                Unlink
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderSourceBadge(lead.source)}
                        </td>

                        {/* Project */}
                        <td className="px-4 py-3 whitespace-nowrap text-ink-700">
                          {lead.projectName || "Unassigned"}
                        </td>

                        {/* Wants & Budget */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-ink-900">{lead.wants || "—"}</div>
                          {lead.budgetMin && lead.budgetMax && (
                            <div className="text-[11px] text-ink-400">
                              ₹{(lead.budgetMin / 100000).toFixed(0)}L - ₹{(lead.budgetMax / 100000).toFixed(0)}L
                            </div>
                          )}
                        </td>

                        {/* Visit Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {renderStatusPill(lead.status)}
                        </td>

                        {/* Assigned Executive Picker */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            value={lead.assignedExecutiveId || ""}
                            disabled={updatingLeadId === lead.id}
                            onChange={(e) =>
                              handleAssign(lead.id, e.target.value || null)
                            }
                            className="rounded border border-surface-300 bg-surface-100 px-2 py-1 text-xs text-ink-900 focus:border-brand-500 focus:bg-surface-50 focus:outline-none"
                          >
                            <option value="">Unassigned</option>
                            {executives.map((exec) => (
                              <option key={exec.id} value={exec.id}>
                                {exec.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Response Time */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatResponseTime(lead.createdAt, lead.firstResponseAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="divide-y divide-surface-200 lg:hidden">
              {leads.map((lead) => {
                const isDup = Boolean(lead.duplicateOfId);

                return (
                  <div
                    key={lead.id}
                    className={`p-4 space-y-3 ${
                      isDup ? "bg-amber-50/20" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs font-semibold text-ink-900">
                          {lead.leadCode}
                        </div>
                        <div className="font-medium text-ink-950 text-sm mt-0.5">
                          {lead.name}
                        </div>
                        <div className="font-mono text-xs text-ink-500">
                          {formatPhoneDisplay(lead.phoneE164)}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        {renderSourceBadge(lead.source)}
                        <div>{renderStatusPill(lead.status)}</div>
                      </div>
                    </div>

                    {isDup && (
                      <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 flex items-center justify-between">
                        <span>Duplicate of {lead.canonicalLeadCode || "Original"}</span>
                        <button
                          onClick={() => handleUnlinkDuplicate(lead.id)}
                          className="font-medium underline hover:text-amber-950"
                        >
                          Unlink
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-surface-200 pt-2 text-ink-600">
                      <div>
                        <span className="text-[10px] text-ink-400 block">Project</span>
                        <span className="font-medium">{lead.projectName || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-400 block">Wants</span>
                        <span className="font-medium">{lead.wants || "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-surface-200 pt-2 text-xs">
                      <div>
                        <span className="text-[10px] text-ink-400 block">Response Time</span>
                        {formatResponseTime(lead.createdAt, lead.firstResponseAt)}
                      </div>
                      <div>
                        <select
                          value={lead.assignedExecutiveId || ""}
                          onChange={(e) =>
                            handleAssign(lead.id, e.target.value || null)
                          }
                          className="rounded border border-surface-300 bg-surface-100 px-2 py-1 text-xs text-ink-900"
                        >
                          <option value="">Unassigned</option>
                          {executives.map((exec) => (
                            <option key={exec.id} value={exec.id}>
                              {exec.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
