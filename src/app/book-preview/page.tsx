"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SlotPicker } from "@/components/booking/slot-picker";
import {
  BookingConfirmationCard,
  BookingConfirmationProps,
} from "@/components/booking/booking-confirmation-card";
import { FreeSlot } from "@/server/services/booking/types";

interface Project {
  id: string;
  name: string;
  locationName: string;
  reraNumber: string;
}

interface SampleLead {
  id: string;
  leadCode: string;
  name: string;
  phoneE164: string;
  wants: string | null;
  status: string;
}

export default function BookingPreviewPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [leads, setLeads] = useState<SampleLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");

  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alternativeSlots, setAlternativeSlots] = useState<FreeSlot[] | null>(null);

  // Confirmed booking state to display the confirmation card
  const [confirmedDetails, setConfirmedDetails] = useState<BookingConfirmationProps | null>(null);

  // 1. Load projects and available leads
  useEffect(() => {
    async function loadData() {
      setIsLoadingProjects(true);
      try {
        const [projRes, leadsRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/leads?limit=25&duplicates=exclude"),
        ]);

        if (projRes.ok) {
          const pData = await projRes.json();
          if (pData.success && pData.projects?.length > 0) {
            setProjects(pData.projects);
            setSelectedProjectId(pData.projects[0].id);
          }
        }

        if (leadsRes.ok) {
          const lData = await leadsRes.json();
          if (lData.success && lData.leads?.length > 0) {
            // Filter leads that are not already visit_scheduled or visited
            const candidateLeads = lData.leads.filter(
              (l: SampleLead) => l.status !== "visit_scheduled" && l.status !== "visited"
            );
            setLeads(candidateLeads.length > 0 ? candidateLeads : lData.leads.slice(0, 5));
            if (candidateLeads.length > 0) {
              setSelectedLeadId(candidateLeads[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load initial preview data:", err);
      } finally {
        setIsLoadingProjects(false);
      }
    }

    loadData();
  }, []);

  // 2. Fetch free slots whenever the selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    async function loadSlots() {
      setIsLoadingSlots(true);
      setSelectedSlot(null);
      setErrorMessage(null);
      setAlternativeSlots(null);
      try {
        const res = await fetch(`/api/slots?projectId=${selectedProjectId}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setSlots(data.slots || []);
        } else {
          setSlots([]);
        }
      } catch (err) {
        console.error("Failed to fetch slots:", err);
        setSlots([]);
      } finally {
        setIsLoadingSlots(false);
      }
    }

    loadSlots();
  }, [selectedProjectId]);

  // Handle Book Visit
  async function handleBookVisit() {
    if (!selectedSlot || !selectedLeadId) {
      alert("Please select both a visit slot and a candidate buyer lead.");
      return;
    }

    setIsBooking(true);
    setErrorMessage(null);
    setAlternativeSlots(null);

    const activeProject = projects.find((p) => p.id === selectedProjectId);
    const activeLead = leads.find((l) => l.id === selectedLeadId);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          leadId: selectedLeadId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "SLOT_TAKEN") {
          setErrorMessage(
            "This slot was just booked by another buyer! Here are recommended alternative free slots:"
          );
          setAlternativeSlots(data.alternativeSlots || []);
          return;
        }
        throw new Error(data.message || data.error || "Failed to book slot");
      }

      // Successful booking -> Show Confirmation Card
      setConfirmedDetails({
        bookingId: data.booking.id,
        leadName: activeLead?.name || "Verified Buyer",
        leadCode: activeLead?.leadCode,
        projectName: activeProject?.name || "Company A Project",
        projectAddress: activeProject?.locationName || "Ahmedabad, Gujarat",
        projectRera: activeProject?.reraNumber,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        executiveName: selectedSlot.executiveFirstName
          ? `${selectedSlot.executiveFirstName} (Project Specialist)`
          : "Sales Executive",
        onDone: () => {
          setConfirmedDetails(null);
          // Refresh slots
          setSelectedSlot(null);
        },
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error booking visit");
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Step 3 Preview Banner */}
      <div className="mb-6 rounded-2xl border border-primary-200 bg-primary-50/50 p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-800">
                Step 3 Interactive Preview Harness
              </span>
            </div>
            <h1 className="mt-1 font-serif text-lg font-bold text-ink-900 sm:text-xl">
              Real-Time Slot Picker &amp; Booking Guard
            </h1>
            <p className="mt-1 text-xs text-ink-600 leading-relaxed">
              This harness allows end-to-end verification of database-level slot locking,
              concurrency conflict handling, reminder creation, and confirmation card generation.
              In Step 4, this booking flow is triggered via AI tool-calling (<code className="font-mono text-primary-700">book_visit</code>)
              inside the public buyer chat.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmed Card Mode */}
      {confirmedDetails ? (
        <div className="space-y-4">
          <BookingConfirmationCard {...confirmedDetails} />
          <div className="flex justify-between items-center px-1">
            <button
              onClick={() => {
                setConfirmedDetails(null);
                setSelectedSlot(null);
              }}
              className="text-xs font-semibold text-primary-700 hover:text-primary-900 underline"
            >
              ← Book Another Slot / Test Again
            </button>
            <Link
              href="/executive/visits"
              className="text-xs font-semibold text-ink-700 hover:text-ink-900 underline"
            >
              View in Executive Visits Queue →
            </Link>
          </div>
        </div>
      ) : (
        /* Booking Workflow */
        <div className="space-y-6 rounded-2xl border border-surface-300 bg-white p-6 shadow-sm sm:p-8">
          {/* 1. Project Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-600 mb-2">
              1. Select Project
            </label>
            {isLoadingProjects ? (
              <div className="h-10 animate-pulse rounded-lg bg-surface-100" />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {projects.map((proj) => {
                  const isSelected = proj.id === selectedProjectId;
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                        isSelected
                          ? "border-primary-600 bg-primary-50/50 ring-1 ring-primary-600"
                          : "border-surface-300 bg-surface-50 hover:bg-surface-100"
                      }`}
                    >
                      <span className="text-sm font-semibold text-ink-900">
                        {proj.name}
                      </span>
                      <span className="mt-0.5 text-xs text-ink-500">
                        {proj.locationName} • RERA: {proj.reraNumber}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Candidate Lead Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-600 mb-2">
              2. Select Test Buyer Lead
            </label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full rounded-xl border border-surface-300 bg-surface-50 px-3 py-2.5 text-xs font-medium text-ink-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.leadCode} — {l.name} ({l.phoneE164}) {l.wants ? `[${l.wants}]` : ""} — Status: {l.status}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Slot Picker */}
          <div>
            <SlotPicker
              slots={slots}
              selectedSlotId={selectedSlot?.id || null}
              onSelectSlot={(slot) => {
                setSelectedSlot(slot);
                setErrorMessage(null);
                setAlternativeSlots(null);
              }}
              isLoading={isLoadingSlots}
            />
          </div>

          {/* Error Message & Slot-Taken Alternatives */}
          {errorMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="font-semibold">{errorMessage}</div>
              {alternativeSlots && alternativeSlots.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="font-medium text-amber-800">Available Alternative Slots:</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {alternativeSlots.map((alt) => {
                      const d = new Date(alt.startsAt);
                      return (
                        <button
                          key={alt.id}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(alt);
                            setErrorMessage(null);
                            setAlternativeSlots(null);
                          }}
                          className="rounded-lg border border-amber-300 bg-white p-2.5 text-left text-xs font-medium text-ink-900 shadow-sm hover:border-primary-500 hover:bg-primary-50"
                        >
                          <div className="font-semibold text-primary-800">
                            {d.toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                          <div className="text-ink-600">
                            {d.toLocaleTimeString("en-IN", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected Slot summary & Submit Button */}
          <div className="flex flex-col gap-3 border-t border-surface-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-ink-500">
              {selectedSlot ? (
                <div>
                  Selected:{" "}
                  <span className="font-semibold text-ink-900">
                    {new Date(selectedSlot.startsAt).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    at{" "}
                    {new Date(selectedSlot.startsAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                  {selectedSlot.executiveFirstName && (
                    <span className="ml-1 text-ink-400">
                      (with {selectedSlot.executiveFirstName})
                    </span>
                  )}
                </div>
              ) : (
                "Please choose an available time slot above to book."
              )}
            </div>

            <button
              type="button"
              disabled={!selectedSlot || !selectedLeadId || isBooking}
              onClick={handleBookVisit}
              className="rounded-xl bg-primary-600 px-6 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-primary-700 disabled:opacity-50"
            >
              {isBooking ? "Securing Slot..." : "Confirm Site Visit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
