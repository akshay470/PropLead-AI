"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";
import { SlotPicker } from "@/components/booking/slot-picker";
import { FreeSlot } from "@/server/services/booking/types";

interface VisitRecord {
  id: string;
  status: "confirmed" | "visited" | "no_show" | "cancelled";
  createdAt: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  projectId: string;
  projectName: string;
  projectAddress: string | null;
  projectLat: number | null;
  projectLng: number | null;
  projectRera: string | null;
  leadId: string;
  leadCode: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string | null;
  leadWants: string | null;
  executiveId: string | null;
  executiveName: string | null;
}

export default function ExecutiveVisitsPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Reschedule modal state
  const [reschedulingVisit, setReschedulingVisit] = useState<VisitRecord | null>(null);
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<FreeSlot | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const fetchVisits = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/executive/visits?type=${activeTab}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load visits");
      }
      setVisits(data.visits || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error fetching visits");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // Mark Visit Outcome (visited / no_show)
  async function handleMarkOutcome(bookingId: string, outcome: "visited" | "no_show") {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/outcome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to mark visit as ${outcome}`);
      }
      // Update local state
      setVisits((prev) =>
        prev.map((v) => (v.id === bookingId ? { ...v, status: outcome } : v))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update outcome");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Cancel Booking
  async function handleCancel(bookingId: string) {
    if (!confirm("Are you sure you want to cancel this scheduled site visit?")) {
      return;
    }
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Executive cancelled appointment" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel visit");
      }
      // Update local state
      setVisits((prev) =>
        prev.map((v) => (v.id === bookingId ? { ...v, status: "cancelled" } : v))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel visit");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Open Reschedule Modal
  async function handleOpenReschedule(visit: VisitRecord) {
    setReschedulingVisit(visit);
    setSelectedRescheduleSlot(null);
    setRescheduleError(null);
    setIsLoadingSlots(true);

    try {
      const res = await fetch(`/api/slots?projectId=${visit.projectId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load alternative slots");
      }
      setFreeSlots(data.slots || []);
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : "Could not load free slots");
    } finally {
      setIsLoadingSlots(false);
    }
  }

  // Submit Reschedule
  async function handleSubmitReschedule() {
    if (!reschedulingVisit || !selectedRescheduleSlot) return;
    setActionLoadingId(reschedulingVisit.id);
    setRescheduleError(null);

    try {
      const res = await fetch(`/api/bookings/${reschedulingVisit.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSlotId: selectedRescheduleSlot.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.code === "SLOT_TAKEN") {
          throw new Error("This slot was just booked by another buyer. Please pick another.");
        }
        throw new Error(data.error || "Failed to reschedule booking");
      }

      setReschedulingVisit(null);
      await fetchVisits();
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setActionLoadingId(null);
    }
  }

  function renderStatusBadge(status: VisitRecord["status"]) {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            Confirmed
          </span>
        );
      case "visited":
        return (
          <span className="inline-flex items-center rounded-full border border-primary-300 bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-800">
            Visited
          </span>
        );
      case "no_show":
        return (
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            No Show
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center rounded-full border border-surface-300 bg-surface-200 px-2.5 py-0.5 text-xs font-medium text-ink-500">
            Cancelled
          </span>
        );
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Subnav & Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-surface-300 pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-600">
              Company A • Field Operations
            </span>
          </div>
          <h1 className="mt-1 font-serif text-2xl font-light tracking-tight text-ink-950 sm:text-3xl">
            My Site Visits
          </h1>
          <p className="mt-1 text-xs text-ink-500">
            Real-time appointment schedule, buyer contact cards, navigation pins, and visit outcome logging.
          </p>
        </div>

        {/* View Switcher: Leads vs Visits */}
        <div className="flex items-center gap-2">
          <Link
            href="/executive/leads"
            className="rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-surface-200"
          >
            Leads Pipeline
          </Link>
          <span className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-surface-50">
            Site Visits
          </span>
          <button
            onClick={() => fetchVisits()}
            className="rounded-lg border border-surface-300 bg-surface-50 p-1.5 text-ink-700 transition hover:bg-surface-200"
            title="Refresh visits"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex items-center gap-3 border-b border-surface-300">
        <button
          onClick={() => setActiveTab("upcoming")}
          className={`pb-3 text-xs font-semibold tracking-wide transition border-b-2 ${
            activeTab === "upcoming"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-ink-500 hover:text-ink-900"
          }`}
        >
          Upcoming Visits
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`pb-3 text-xs font-semibold tracking-wide transition border-b-2 ${
            activeTab === "past"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-ink-500 hover:text-ink-900"
          }`}
        >
          Past Visits &amp; Outcomes
        </button>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => fetchVisits()}
            className="rounded bg-red-100 px-3 py-1 font-semibold text-red-800 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-surface-300 bg-surface-50"
            />
          ))}
        </div>
      ) : visits.length === 0 ? (
        /* Empty State */
        <div className="mt-8 rounded-2xl border border-surface-300 bg-surface-50 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-200 text-ink-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="mt-4 font-serif text-base font-semibold text-ink-900">
            {activeTab === "upcoming"
              ? "No upcoming site visits scheduled"
              : "No past site visits on record"}
          </h3>
          <p className="mt-1 text-xs text-ink-500 max-w-sm mx-auto">
            {activeTab === "upcoming"
              ? "When buyers book a slot via the assistant or portal, your confirmed appointments will appear here."
              : "Past visit records and no-show logs will appear here once visits conclude."}
          </p>
        </div>
      ) : (
        /* Visits Cards List */
        <div className="mt-6 space-y-4">
          {visits.map((visit) => {
            const startDate = new Date(visit.startsAt);
            const endDate = new Date(visit.endsAt);
            const isConfirmed = visit.status === "confirmed";
            const mapsUrl =
              visit.projectLat && visit.projectLng
                ? `https://www.google.com/maps/search/?api=1&query=${visit.projectLat},${visit.projectLng}`
                : visit.projectAddress
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${visit.projectName}, ${visit.projectAddress}`
                  )}`
                : null;

            return (
              <div
                key={visit.id}
                className="overflow-hidden rounded-2xl border border-surface-300 bg-white p-5 shadow-sm transition-all hover:border-surface-400 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left Column: Appointment Time & Project */}
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-surface-300 bg-surface-50 text-center">
                      <span className="text-[10px] font-bold uppercase text-brand-700">
                        {startDate.toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                      <span className="font-serif text-lg font-bold leading-tight text-ink-900">
                        {startDate.getDate()}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-base font-semibold text-ink-900">
                          {startDate.toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}{" "}
                          –{" "}
                          {endDate.toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                        {renderStatusBadge(visit.status)}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-600">
                        <span className="font-semibold text-ink-800">
                          {visit.projectName}
                        </span>
                        {visit.projectRera && (
                          <span className="rounded bg-surface-100 px-1.5 py-0.2 font-mono text-[10px] text-ink-500">
                            {visit.projectRera}
                          </span>
                        )}
                      </div>

                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          {visit.projectAddress || "Open Location Pin"}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Buyer Details */}
                  <div className="border-t border-surface-200 pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-brand-700">
                        {visit.leadCode}
                      </span>
                      <span className="text-sm font-semibold text-ink-900">
                        {visit.leadName}
                      </span>
                    </div>

                    {visit.leadWants && (
                      <div className="mt-0.5 text-xs text-ink-500">
                        Interested in:{" "}
                        <span className="font-medium text-ink-800">
                          {visit.leadWants}
                        </span>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <a
                        href={`tel:${visit.leadPhone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 bg-surface-50 px-2.5 py-1 font-medium text-ink-800 transition hover:bg-surface-200"
                      >
                        <svg
                          className="h-3.5 w-3.5 text-emerald-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        {formatPhoneDisplay(visit.leadPhone)}
                      </a>

                      {visit.leadEmail && (
                        <a
                          href={`mailto:${visit.leadEmail}`}
                          className="text-ink-500 hover:text-ink-800"
                        >
                          {visit.leadEmail}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  {isConfirmed && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-surface-200 pt-3 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionLoadingId === visit.id}
                          onClick={() => handleMarkOutcome(visit.id, "visited")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Mark Visited
                        </button>

                        <button
                          type="button"
                          disabled={actionLoadingId === visit.id}
                          onClick={() => handleMarkOutcome(visit.id, "no_show")}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          Mark No-Show
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionLoadingId === visit.id}
                          onClick={() => handleOpenReschedule(visit)}
                          className="rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-surface-200 disabled:opacity-50"
                        >
                          Reschedule
                        </button>

                        <button
                          type="button"
                          disabled={actionLoadingId === visit.id}
                          onClick={() => handleCancel(visit.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-surface-300 bg-white p-6 shadow-xl sm:p-7">
            <div className="flex items-start justify-between border-b border-surface-200 pb-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-600">
                  Reschedule Site Visit
                </span>
                <h3 className="text-base font-serif font-bold text-ink-900">
                  {reschedulingVisit.leadName} ({reschedulingVisit.leadCode})
                </h3>
                <p className="text-xs text-ink-500">
                  Select a new available 60-minute slot for {reschedulingVisit.projectName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReschedulingVisit(null)}
                className="rounded-lg p-1 text-ink-400 hover:bg-surface-100 hover:text-ink-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {rescheduleError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {rescheduleError}
              </div>
            )}

            <div className="mt-4 max-h-[60vh] overflow-y-auto">
              <SlotPicker
                slots={freeSlots}
                selectedSlotId={selectedRescheduleSlot?.id || null}
                onSelectSlot={(slot) => setSelectedRescheduleSlot(slot)}
                isLoading={isLoadingSlots}
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-surface-200 pt-4">
              <button
                type="button"
                onClick={() => setReschedulingVisit(null)}
                className="rounded-lg border border-surface-300 bg-surface-50 px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-surface-100"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!selectedRescheduleSlot || actionLoadingId === reschedulingVisit.id}
                onClick={handleSubmitReschedule}
                className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
              >
                {actionLoadingId === reschedulingVisit.id ? "Rescheduling..." : "Confirm Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
