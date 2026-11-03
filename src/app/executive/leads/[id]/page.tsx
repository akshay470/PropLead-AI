"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";

interface LeadDetailData {
  lead: {
    id: string;
    leadCode: string;
    name: string;
    phoneE164: string;
    email: string | null;
    source: string;
    status: string;
    wants: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    language: string;
    consentGiven: boolean;
    optedOut: boolean;
    firstResponseAt: string | null;
    createdAt: string;
  };
  project: {
    id: string;
    name: string;
    reraNumber: string;
    locationName: string;
    address: string;
  } | null;
  assignedExecutive: {
    id: string;
    name: string;
    email: string;
  } | null;
  handoff: {
    id: string;
    reason: string;
    status: string;
    summary: string;
    notes: string | null;
    createdAt: string;
    resolvedAt: string | null;
  } | null;
  booking: {
    id: string;
    slotId: string;
    status: string;
    startsAt: string;
    endsAt: string;
    createdAt: string;
  } | null;
  reminders?: Array<{
    id: string;
    type: string;
    scheduledAt: string;
    sentAt: string | null;
    status: string;
  }>;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    language: string;
    flagged: boolean;
    flagReason: string | null;
    latencyMs: number | null;
    factIds: string | null;
    payload: Array<{ type: string; [key: string]: unknown }> | null;
    createdAt: string;
  }>;
}

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<LeadDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdatingBooking, setIsUpdatingBooking] = useState(false);

  const fetchLeadDetail = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/leads/${params.id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load lead details");
      }
      setData(json);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error loading lead");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchLeadDetail();
  }, [fetchLeadDetail]);

  // Handle visit status changes: mark visited / no_show
  async function handleBookingOutcome(outcome: "visited" | "no_show") {
    if (!data?.booking) return;
    setIsUpdatingBooking(true);
    try {
      const res = await fetch(`/api/bookings/${data.booking.id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to record ${outcome}`);
      }
      await fetchLeadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating booking outcome");
    } finally {
      setIsUpdatingBooking(false);
    }
  }

  // Handle cancel booking
  async function handleCancelBooking() {
    if (!data?.booking) return;
    if (!confirm("Are you sure you want to cancel this site visit appointment?")) return;
    setIsUpdatingBooking(true);
    try {
      const res = await fetch(`/api/bookings/${data.booking.id}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to cancel booking");
      }
      await fetchLeadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error cancelling visit");
    } finally {
      setIsUpdatingBooking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#8C653D] border-t-transparent" />
          <p className="text-xs text-[#7A7973]">Loading Lead Profile...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] p-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xs">
          <h2 className="text-base font-semibold text-red-800">Unable to Load Lead</h2>
          <p className="mt-2 text-xs text-[#7A7973]">{errorMessage || "Lead not found"}</p>
          <Link
            href="/executive/leads"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[#8C653D] px-4 py-2 text-xs font-medium text-white hover:bg-[#704E2D]"
          >
            Back to Leads Queue
          </Link>
        </div>
      </div>
    );
  }

  const { lead, project, assignedExecutive, handoff, booking, messages } = data;

  // Parse structured handoff summary if available
  let parsedHandoff: Record<string, unknown> | null = null;
  if (handoff?.summary) {
    try {
      parsedHandoff = JSON.parse(handoff.summary);
    } catch {
      parsedHandoff = null;
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-16">
      {/* 1. Breadcrumbs & Top Navigation */}
      <div className="border-b border-[#EBE7DF] bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#7A7973]">
            <Link href="/executive/leads" className="hover:text-[#141413]">
              Leads
            </Link>
            <span>/</span>
            <Link href="/executive/handoffs" className="hover:text-[#141413]">
              Handoffs
            </Link>
            <span>/</span>
            <span className="font-mono font-medium text-[#141413]">{lead.leadCode}</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/executive/handoffs"
              className="inline-flex min-h-[40px] items-center rounded-lg border border-[#EBE7DF] bg-white px-3 py-1.5 text-xs text-[#575651] hover:bg-[#FAF9F6]"
            >
              Back to Handoffs
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Main Lead Header Card */}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8">
        {/* DO NOT CONTACT ALERT (DPDP Compliance) */}
        {lead.optedOut && (
          <div className="mb-6 rounded-2xl border-2 border-red-300 bg-red-50 p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-red-900 uppercase">
                  DO NOT CONTACT &bull; Buyer Opted Out
                </h3>
                <p className="mt-0.5 text-xs text-red-800">
                  This prospective buyer has formally revoked consent under the DPDP Act 2023. Telecalling, messaging, and visit notifications are strictly halted.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lead Profile Header */}
        <div className="rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[#8C653D]">
                  {lead.leadCode}
                </span>
                <span className="inline-flex items-center rounded-md border border-[#EBE7DF] bg-[#FAF9F6] px-2 py-0.5 text-xs font-medium text-[#575651]">
                  Source: {lead.source.replace(/_/g, " ")}
                </span>
                <span className="inline-flex items-center rounded-md border border-[#E5D4BE] bg-[#FAF6F0] px-2 py-0.5 text-xs font-medium text-[#8C653D]">
                  Status: {lead.status.replace(/_/g, " ")}
                </span>
                <span className="inline-flex items-center rounded-md border border-[#EBE7DF] bg-white px-2 py-0.5 text-xs font-medium text-[#7A7973]">
                  Lang: {lead.language.toUpperCase()}
                </span>
              </div>

              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#141413] sm:text-3xl">
                {lead.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#7A7973]">
                <div>
                  <strong>Project:</strong> {project?.name || "Unassigned Project"}
                </div>
                <div>&bull;</div>
                <div>
                  <strong>Configuration:</strong> {lead.wants || "Not specified"}
                </div>
                {lead.budgetMin && lead.budgetMax && (
                  <>
                    <div>&bull;</div>
                    <div>
                      <strong>Budget:</strong> Rs {lead.budgetMin / 100000}L – {lead.budgetMax / 100000}L
                    </div>
                  </>
                )}
                <div>&bull;</div>
                <div>
                  <strong>Assigned Executive:</strong> {assignedExecutive?.name || "Unassigned"}
                </div>
              </div>
            </div>

            {/* Contact Action Bar (Hidden if Opted Out) */}
            {!lead.optedOut ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={`tel:${lead.phoneE164}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-medium text-white shadow-2xs hover:bg-emerald-800 focus:ring-2 focus:ring-emerald-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Call {formatPhoneDisplay(lead.phoneE164)}</span>
                </a>

                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#EBE7DF] bg-white px-4 py-2.5 text-xs font-medium text-[#141413] hover:bg-[#FAF9F6]"
                  >
                    <svg className="h-4 w-4 text-[#7A7973]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Email Buyer</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
                Contact buttons disabled (Opted Out)
              </div>
            )}
          </div>
        </div>

        {/* 3. Two-Column Dashboard: Handoff & Booking Cards */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card A: AI Handoff & Qualification Summary */}
          <div className="rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#EBE7DF] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#8C653D]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <h2 className="text-sm font-semibold text-[#141413]">AI Handoff Briefing</h2>
              </div>
              {handoff && (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {handoff.reason.replace(/_/g, " ")}
                </span>
              )}
            </div>

            {handoff ? (
              <div className="mt-4 space-y-3 text-xs leading-relaxed">
                {parsedHandoff ? (
                  <>
                    <div className="rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[#7A7973]">Buyer Sentiment:</span>
                        <strong className="text-[#141413]">{String(parsedHandoff.sentiment || "Neutral")}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7A7973]">Desired Unit:</span>
                        <strong className="text-[#141413]">{String(parsedHandoff.bhk || lead.wants || "2/3 BHK")}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7A7973]">Budget Band:</span>
                        <strong className="text-[#141413]">{String(parsedHandoff.budget || "Fact sheet standard")}</strong>
                      </div>
                    </div>

                    {Array.isArray(parsedHandoff.openQuestions) && parsedHandoff.openQuestions.length > 0 && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                        <p className="font-semibold text-blue-900">Questions Bot Could Not Answer:</p>
                        <ul className="mt-1 list-disc pl-4 text-blue-800 space-y-0.5">
                          {parsedHandoff.openQuestions.map((q, i) => (
                            <li key={i}>{String(q)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedHandoff.recommendedNextAction && (
                      <div className="rounded-xl border border-[#E5D4BE] bg-[#FAF6F0] p-3 text-[#704E2D]">
                        <p className="font-semibold">Recommended Next Action:</p>
                        <p className="mt-0.5">{String(parsedHandoff.recommendedNextAction)}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[#575651]">{handoff.summary}</p>
                )}

                {handoff.notes && (
                  <div className="mt-2 rounded-lg bg-stone-100 p-2.5 text-[11px] text-stone-700">
                    <strong>Executive Notes:</strong> {handoff.notes}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs text-[#7A7973]">
                No executive handoffs recorded for this lead yet. Autonomous assistant answered all enquiries within registered fact sheet bounds.
              </p>
            )}
          </div>

          {/* Card B: Site Visit & Booking Status */}
          <div className="rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#EBE7DF] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FAF6F0] text-[#8C653D]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <h2 className="text-sm font-semibold text-[#141413]">Site Visit Appointment</h2>
              </div>
              {booking && (
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                    booking.status === "confirmed"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : booking.status === "visited"
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : booking.status === "no_show"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-stone-200 bg-stone-50 text-stone-600"
                  }`}
                >
                  {booking.status.toUpperCase()}
                </span>
              )}
            </div>

            {booking ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="rounded-xl border border-[#EBE7DF] bg-[#FAF9F6] p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#7A7973]">Appointment Time:</span>
                    <strong className="text-[#141413]">
                      {new Date(booking.startsAt).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A7973]">Project Location:</span>
                    <span className="text-[#141413] font-medium">{project?.locationName || "Bodakdev"}</span>
                  </div>
                </div>

                {/* Visit Actions */}
                {booking.status === "confirmed" && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[#EBE7DF]">
                    <button
                      type="button"
                      disabled={isUpdatingBooking}
                      onClick={() => handleBookingOutcome("visited")}
                      className="inline-flex min-h-[40px] items-center rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800"
                    >
                      Mark Visited
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingBooking}
                      onClick={() => handleBookingOutcome("no_show")}
                      className="inline-flex min-h-[40px] items-center rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
                    >
                      Mark No-Show
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingBooking}
                      onClick={handleCancelBooking}
                      className="inline-flex min-h-[40px] items-center rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Cancel Visit
                    </button>
                  </div>
                )}

                {/* Reminder Schedule Timeline */}
                <div className="pt-3 border-t border-[#EBE7DF]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-500">
                      Automated Reminder Timeline (WhatsApp)
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">v1.2.0 Statutory</span>
                  </div>

                  {lead.optedOut ? (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-800">
                      Reminders halted: Buyer opted out of communications under DPDP Act 2023.
                    </div>
                  ) : data.reminders && data.reminders.length > 0 ? (
                    <div className="space-y-2">
                      {data.reminders.map((rem) => {
                        const is24h = rem.type === "one_day_before";
                        const scheduledDate = new Date(rem.scheduledAt);
                        const isSent = rem.status === "sent";

                        return (
                          <div
                            key={rem.id}
                            className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isSent
                                    ? "bg-emerald-500"
                                    : rem.status === "pending"
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-stone-300"
                                }`}
                              />
                              <div>
                                <span className="font-medium text-stone-900">
                                  {is24h ? "1-Day Reminder" : "2-Hour Reminder"}
                                </span>
                                <span className="text-stone-400 ml-1.5 font-mono text-[11px]">
                                  {scheduledDate.toLocaleTimeString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}{" "}
                                  IST
                                </span>
                              </div>
                            </div>

                            <div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  isSent
                                    ? "bg-emerald-100 text-emerald-800"
                                    : rem.status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-stone-200 text-stone-600"
                                }`}
                              >
                                {rem.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-stone-400 italic">
                      No automated reminders scheduled for this appointment.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-center py-6 text-xs text-[#7A7973]">
                <p>No confirmed site visit booked for this lead.</p>
                <p className="mt-1">
                  You can schedule or offer available slots directly during follow-up.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Full Chat Transcript with Quiet Tool Events */}
        <div className="mt-8 rounded-2xl border border-[#EBE7DF] bg-white p-6 shadow-xs sm:p-8">
          <div className="flex items-center justify-between border-b border-[#EBE7DF] pb-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#141413]">
                Full Conversation Transcript
              </h2>
              <p className="mt-0.5 text-xs text-[#7A7973]">
                Audited chronological log between buyer and autonomous assistant, including grounded tool events.
              </p>
            </div>
            <span className="rounded-full bg-[#FAF9F6] px-3 py-1 text-xs text-[#7A7973] border border-[#EBE7DF]">
              {messages.length} messages
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {messages.length === 0 ? (
              <p className="text-center py-8 text-xs text-[#7A7973]">
                No chat messages recorded for this lead.
              </p>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                const timeString = new Date(m.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 px-1 text-[11px] text-[#AFAEA7]">
                      <span>{isUser ? lead.name : "PropLead Assistant"}</span>
                      <span>&bull;</span>
                      <span>{timeString}</span>
                      {m.flagged && (
                        <span className="ml-1 rounded-sm bg-red-100 px-1.5 py-0.2 text-[10px] font-semibold text-red-800">
                          FLAGGED: {m.flagReason || "Compliance"}
                        </span>
                      )}
                    </div>

                    <div
                      className={`mt-1 max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed sm:max-w-[75%] ${
                        isUser
                          ? "rounded-tr-xs bg-[#2A2926] text-white"
                          : "rounded-tl-xs border border-[#EBE7DF] bg-[#FAF9F6] text-[#141413]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>

                      {/* Quiet Tool Events */}
                      {!isUser && m.payload && Array.isArray(m.payload) && m.payload.length > 0 && (
                        <div className="mt-2.5 border-t border-[#EBE7DF] pt-2 space-y-1">
                          {m.payload.map((p, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1 text-[10px] text-[#8C653D]"
                            >
                              <span className="font-mono">⚡ Tool Event:</span>
                              <span>
                                {p.type === "slot_options"
                                  ? `Retrieved ${Array.isArray(p.slots) ? p.slots.length : 0} available visit slots`
                                  : p.type === "booking_confirmation"
                                  ? `Confirmed visit booking #${String(p.bookingId || "").slice(0, 8)}`
                                  : p.type === "handoff_notice"
                                  ? "Dispatched executive handoff briefing"
                                  : String(p.type)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
