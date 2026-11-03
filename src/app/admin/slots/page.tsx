"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DayHeader {
  dateKey: string;
  dateLabel: string;
  weekday: string;
  isToday: boolean;
}

interface SlotItem {
  id: string;
  projectId: string;
  projectName: string;
  executiveId: string;
  executiveName: string;
  startsAt: string;
  endsAt: string;
  dateKey: string;
  startHour: number;
  timeLabel: string;
  status: "available" | "booked" | "blocked";
  blockedReason?: string | null;
  booking?: {
    id: string;
    leadId: string;
    leadName: string;
    leadCode: string;
    phoneE164: string;
  } | null;
}

interface ProjectOption {
  id: string;
  name: string;
  locationName: string;
  address: string;
  lat: string;
  lng: string;
}

interface ExecutiveOption {
  id: string;
  name: string;
  email: string;
  assignedProjectIds?: string[];
}

export default function AdminSlotsPage() {
  const [weekStartIST, setWeekStartIST] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<string>("");

  const [days, setDays] = useState<DayHeader[]>([]);
  const [hours, setHours] = useState<number[]>([10, 11, 12, 13, 14, 15, 16, 17]);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [executives, setExecutives] = useState<ExecutiveOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modals state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{
    type: "slot" | "day";
    slotId?: string;
    executiveId?: string;
    dateIST?: string;
    timeLabel?: string;
  } | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const [isCoverageOpen, setIsCoverageOpen] = useState(false);
  const [coverageData, setCoverageData] = useState<{
    projects: Array<{ id: string; name: string }>;
    executives: Array<{ id: string; name: string; assignedProjectIds: string[] }>;
  } | null>(null);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);

  // Active day tab for mobile (defaults to today or Monday)
  const [activeMobileDay, setActiveMobileDay] = useState<string>("");

  const loadSlots = useCallback(async (targetWeek?: string) => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const params = new URLSearchParams();
      if (targetWeek) params.set("weekStartIST", targetWeek);
      else if (weekStartIST) params.set("weekStartIST", weekStartIST);

      if (selectedProjectId) params.set("projectId", selectedProjectId);
      if (selectedExecutiveId) params.set("executiveId", selectedExecutiveId);

      const res = await fetch(`/api/admin/slots?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load schedule");
      }

      setWeekStartIST(json.weekStartIST);
      setDays(json.days || []);
      setHours(json.hours || [10, 11, 12, 13, 14, 15, 16, 17]);
      setSlots(json.slots || []);
      setProjects(json.projects || []);
      setExecutives(json.executives || []);

      if (json.days && json.days.length > 0) {
        const todayDay = json.days.find((d: DayHeader) => d.isToday);
        setActiveMobileDay(todayDay ? todayDay.dateKey : json.days[0].dateKey);
      }
    } catch (err) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Error loading slots",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [weekStartIST, selectedProjectId, selectedExecutiveId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Week navigation helpers
  function navigateWeek(deltaWeeks: number) {
    if (!weekStartIST) return;
    const [y, m, d] = weekStartIST.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + deltaWeeks * 7));
    const nextKey = date.toISOString().slice(0, 10);
    setWeekStartIST(nextKey);
    loadSlots(nextKey);
  }

  function goToToday() {
    setWeekStartIST("");
    loadSlots("");
  }

  // Delete a slot
  async function handleDeleteSlot(slotId: string) {
    if (!confirm("Are you sure you want to delete this unbooked slot?")) return;
    try {
      const res = await fetch(`/api/admin/slots/${slotId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete slot");
      }
      setActionMessage({ text: "Slot removed successfully.", type: "success" });
      loadSlots();
    } catch (err) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Could not delete slot",
        type: "error",
      });
    }
  }

  // Unblock a slot
  async function handleUnblockSlot(slotId: string) {
    try {
      const res = await fetch(`/api/admin/slots/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock_slot", slotId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to unblock slot");
      }
      setActionMessage({ text: "Slot is now available for booking.", type: "success" });
      loadSlots();
    } catch (err) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Could not unblock slot",
        type: "error",
      });
    }
  }

  // Submit Block action (slot or day)
  async function handleConfirmBlock() {
    if (!blockTarget) return;
    try {
      let body: any;
      if (blockTarget.type === "slot") {
        body = {
          action: "block_slot",
          slotId: blockTarget.slotId,
          reason: blockReason.trim() || undefined,
        };
      } else {
        body = {
          action: "block_day",
          executiveId: blockTarget.executiveId,
          dateIST: blockTarget.dateIST,
          reason: blockReason.trim() || undefined,
        };
      }

      const res = await fetch(`/api/admin/slots/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to block");
      }

      setActionMessage({ text: json.message || "Schedule updated.", type: "success" });
      setIsBlockModalOpen(false);
      setBlockTarget(null);
      setBlockReason("");
      loadSlots();
    } catch (err) {
      setActionMessage({
        text: err instanceof Error ? err.message : "Failed to block",
        type: "error",
      });
    }
  }

  // Open Coverage assignments modal
  async function handleOpenCoverage() {
    try {
      const res = await fetch("/api/admin/coverage");
      const json = await res.json();
      if (res.ok && json.success) {
        setCoverageData({
          projects: json.projects,
          executives: json.executives,
        });
        setIsCoverageOpen(true);
      }
    } catch (err) {
      alert("Failed to load coverage settings");
    }
  }

  // Save coverage assignment for an executive
  async function handleSaveCoverage(executiveId: string, projectIds: string[]) {
    try {
      const res = await fetch("/api/admin/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executiveId, projectIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update coverage");
      }
      setActionMessage({ text: "Executive project coverage updated.", type: "success" });
      handleOpenCoverage(); // refresh
      loadSlots();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating coverage");
    }
  }

  // Open Location editor modal
  function handleOpenLocationModal(proj: ProjectOption) {
    setEditingProject({
      id: proj.id,
      name: proj.name,
      address: proj.address,
      lat: parseFloat(proj.lat) || 23.03,
      lng: parseFloat(proj.lng) || 72.51,
    });
    setIsLocationModalOpen(true);
  }

  // Save project location
  async function handleSaveProjectLocation() {
    if (!editingProject) return;
    try {
      const res = await fetch(`/api/admin/projects/${editingProject.id}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: editingProject.address,
          lat: Number(editingProject.lat),
          lng: Number(editingProject.lng),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update location");
      }
      setActionMessage({ text: "Project location and map pin updated.", type: "success" });
      setIsLocationModalOpen(false);
      setEditingProject(null);
      loadSlots();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating location");
    }
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1C1917] pb-24 font-sans">
      {/* Top Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/review"
              className="text-stone-500 hover:text-stone-900 transition-colors text-xs uppercase tracking-wider font-medium"
            >
              &larr; Admin Portal
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-stone-900 font-semibold text-sm">Slot & Rota Scheduling</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsGenerateOpen(true)}
              className="text-xs font-medium bg-[#1F4E3D] text-white px-3 py-1.5 rounded-lg hover:bg-[#16382c] shadow-xs transition-colors"
            >
              + Generate Slots
            </button>
            <button
              onClick={handleOpenCoverage}
              className="text-xs font-medium bg-white text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Executive Coverage
            </button>
            {projects.length > 0 && (
              <button
                onClick={() => handleOpenLocationModal(projects[0])}
                className="text-xs font-medium bg-white text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Project Pins & Maps
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Banner Alert */}
        {actionMessage && (
          <div
            className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${
              actionMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="font-bold ml-4 hover:opacity-75"
            >
              &times;
            </button>
          </div>
        )}

        {/* Filters & Week Navigation Strip */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs"
              title="Previous Week"
            >
              &larr; Prev
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs font-medium text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-50"
            >
              Current Week
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs"
              title="Next Week"
            >
              Next &rarr;
            </button>

            {days.length > 0 && (
              <span className="text-xs font-semibold text-stone-900 ml-2 font-mono">
                {days[0].dateLabel} &ndash; {days[6].dateLabel} (IST)
              </span>
            )}
          </div>

          {/* Project & Executive Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E3D]"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.locationName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedExecutiveId}
                onChange={(e) => setSelectedExecutiveId(e.target.value)}
                className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E3D]"
              >
                <option value="">All Sales Executives</option>
                {executives.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadSlots()}
              className="text-xs text-stone-600 hover:text-stone-900 underline"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-stone-500 px-1">
          <span className="font-semibold text-stone-700">Slot Status:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Free / Available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Booked (with Buyer details)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-400" /> Blocked (Admin / Leave)
          </span>
        </div>

        {/* Loading Indicator */}
        {isLoading ? (
          <div className="p-16 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-stone-300 border-t-[#1F4E3D] rounded-full mb-2" />
            <p className="text-xs font-medium">Loading rota slots...</p>
          </div>
        ) : (
          <>
            {/* DESKTOP WEEK GRID (Hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto bg-white rounded-2xl border border-stone-200 shadow-xs">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/70">
                    <th className="p-3 text-[11px] font-semibold text-stone-500 uppercase tracking-wider w-24">
                      Time (IST)
                    </th>
                    {days.map((d) => (
                      <th
                        key={d.dateKey}
                        className={`p-3 text-xs font-semibold border-l border-stone-200 ${
                          d.isToday ? "bg-emerald-50/50 text-[#1F4E3D]" : "text-stone-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div>{d.weekday}</div>
                            <div className="text-[11px] font-mono font-normal text-stone-500">
                              {d.dateLabel.split(",")[1]}
                            </div>
                          </div>
                          {selectedExecutiveId && (
                            <button
                              onClick={() => {
                                setBlockTarget({
                                  type: "day",
                                  executiveId: selectedExecutiveId,
                                  dateIST: d.dateKey,
                                });
                                setIsBlockModalOpen(true);
                              }}
                              className="text-[10px] text-stone-500 hover:text-red-700 hover:underline px-1 py-0.5"
                              title="Block this day for executive"
                            >
                              Block Day
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {hours.map((hour) => {
                    const hourLabel = `${hour === 12 ? 12 : hour % 12}:00 ${
                      hour >= 12 ? "PM" : "AM"
                    }`;

                    return (
                      <tr key={hour} className="hover:bg-stone-50/40">
                        <td className="p-3 font-mono text-[11px] text-stone-500 whitespace-nowrap bg-stone-50/30">
                          {hourLabel}
                        </td>

                        {days.map((day) => {
                          const slotMatches = slots.filter(
                            (s) => s.dateKey === day.dateKey && s.startHour === hour
                          );

                          return (
                            <td
                              key={day.dateKey}
                              className={`p-2 border-l border-stone-200 align-top ${
                                day.isToday ? "bg-emerald-50/10" : ""
                              }`}
                            >
                              {slotMatches.length === 0 ? (
                                <div className="text-[11px] text-stone-300 italic py-1 text-center">
                                  &mdash;
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {slotMatches.map((slot) => (
                                    <div
                                      key={slot.id}
                                      className={`p-2 rounded-lg border text-[11px] transition-all ${
                                        slot.status === "booked"
                                          ? "bg-amber-50/80 border-amber-200 text-amber-950"
                                          : slot.status === "blocked"
                                          ? "bg-stone-100 border-stone-200 text-stone-600"
                                          : "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between font-medium">
                                        <span className="truncate max-w-[120px]">
                                          {slot.executiveName}
                                        </span>
                                        <span
                                          className={`text-[9px] uppercase px-1 py-0.5 rounded font-bold ${
                                            slot.status === "booked"
                                              ? "bg-amber-200 text-amber-900"
                                              : slot.status === "blocked"
                                              ? "bg-stone-200 text-stone-700"
                                              : "bg-emerald-200 text-emerald-900"
                                          }`}
                                        >
                                          {slot.status}
                                        </span>
                                      </div>

                                      {/* Project name if viewing all projects */}
                                      {!selectedProjectId && (
                                        <div className="text-[10px] text-stone-500 truncate">
                                          {slot.projectName}
                                        </div>
                                      )}

                                      {/* Booked lead details */}
                                      {slot.status === "booked" && slot.booking && (
                                        <div className="mt-1 pt-1 border-t border-amber-200 text-[10px]">
                                          <div className="font-semibold text-amber-900 truncate">
                                            {slot.booking.leadName}
                                          </div>
                                          <div className="font-mono text-amber-700">
                                            {slot.booking.leadCode}
                                          </div>
                                        </div>
                                      )}

                                      {/* Blocked reason */}
                                      {slot.status === "blocked" && slot.blockedReason && (
                                        <div className="mt-1 text-[10px] text-stone-500 italic truncate">
                                          &ldquo;{slot.blockedReason}&rdquo;
                                        </div>
                                      )}

                                      {/* Slot actions */}
                                      <div className="mt-1.5 pt-1 border-t border-black/5 flex items-center justify-between text-[10px]">
                                        {slot.status === "available" && (
                                          <>
                                            <button
                                              onClick={() => {
                                                setBlockTarget({
                                                  type: "slot",
                                                  slotId: slot.id,
                                                  timeLabel: slot.timeLabel,
                                                });
                                                setIsBlockModalOpen(true);
                                              }}
                                              className="text-stone-600 hover:text-stone-900 underline"
                                            >
                                              Block
                                            </button>
                                            <button
                                              onClick={() => handleDeleteSlot(slot.id)}
                                              className="text-red-600 hover:text-red-900 underline ml-2"
                                            >
                                              Delete
                                            </button>
                                          </>
                                        )}

                                        {slot.status === "blocked" && (
                                          <button
                                            onClick={() => handleUnblockSlot(slot.id)}
                                            className="text-emerald-700 hover:text-emerald-900 font-medium underline"
                                          >
                                            Unblock
                                          </button>
                                        )}

                                        {slot.status === "booked" && (
                                          <span className="text-[9px] text-stone-400 italic">
                                            Reschedule in visits
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE VIEW (375px+ Friendly Tabbed Accordion) */}
            <div className="block md:hidden space-y-4">
              {/* Day selection pill strip */}
              <div className="flex overflow-x-auto gap-2 pb-2">
                {days.map((d) => (
                  <button
                    key={d.dateKey}
                    type="button"
                    onClick={() => setActiveMobileDay(d.dateKey)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border shrink-0 transition-all ${
                      activeMobileDay === d.dateKey
                        ? "bg-[#1F4E3D] text-white border-[#1F4E3D] shadow-xs"
                        : "bg-white text-stone-700 border-stone-200"
                    }`}
                  >
                    <div>{d.weekday}</div>
                    <div className="text-[10px] opacity-80">{d.dateKey.slice(5)}</div>
                  </button>
                ))}
              </div>

              {/* Slots list for selected day */}
              <div className="space-y-3">
                {hours.map((hour) => {
                  const hourLabel = `${hour === 12 ? 12 : hour % 12}:00 ${
                    hour >= 12 ? "PM" : "AM"
                  } IST`;
                  const daySlots = slots.filter(
                    (s) => s.dateKey === activeMobileDay && s.startHour === hour
                  );

                  return (
                    <div
                      key={hour}
                      className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs"
                    >
                      <div className="text-xs font-semibold font-mono text-stone-500 mb-2">
                        {hourLabel}
                      </div>

                      {daySlots.length === 0 ? (
                        <div className="text-xs text-stone-300 italic py-1">No slots scheduled</div>
                      ) : (
                        <div className="space-y-2">
                          {daySlots.map((slot) => (
                            <div
                              key={slot.id}
                              className={`p-3 rounded-lg border text-xs ${
                                slot.status === "booked"
                                  ? "bg-amber-50 border-amber-200 text-amber-950"
                                  : slot.status === "blocked"
                                  ? "bg-stone-50 border-stone-200 text-stone-700"
                                  : "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                              }`}
                            >
                              <div className="flex justify-between items-center font-medium">
                                <span>{slot.executiveName}</span>
                                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded font-bold bg-white/70">
                                  {slot.status}
                                </span>
                              </div>

                              <div className="text-[11px] text-stone-500 mt-0.5">
                                {slot.projectName}
                              </div>

                              {slot.booking && (
                                <div className="mt-2 pt-2 border-t border-amber-200 text-xs">
                                  <div className="font-semibold">{slot.booking.leadName}</div>
                                  <div className="font-mono text-stone-600">
                                    {slot.booking.leadCode}
                                  </div>
                                </div>
                              )}

                              {slot.blockedReason && (
                                <div className="mt-1 text-xs text-stone-500 italic">
                                  Reason: {slot.blockedReason}
                                </div>
                              )}

                              <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-end gap-3 text-xs">
                                {slot.status === "available" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setBlockTarget({
                                          type: "slot",
                                          slotId: slot.id,
                                          timeLabel: slot.timeLabel,
                                        });
                                        setIsBlockModalOpen(true);
                                      }}
                                      className="text-stone-700 underline"
                                    >
                                      Block
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSlot(slot.id)}
                                      className="text-red-700 underline"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}

                                {slot.status === "blocked" && (
                                  <button
                                    onClick={() => handleUnblockSlot(slot.id)}
                                    className="text-emerald-800 font-semibold underline"
                                  >
                                    Unblock
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* MODAL 1: Generate Slots */}
      {isGenerateOpen && (
        <GenerateSlotsModal
          projects={projects}
          executives={executives}
          onClose={() => setIsGenerateOpen(false)}
          onSuccess={(msg) => {
            setIsGenerateOpen(false);
            setActionMessage({ text: msg, type: "success" });
            loadSlots();
          }}
        />
      )}

      {/* MODAL 2: Block Slot or Day */}
      {isBlockModalOpen && blockTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-serif font-bold text-stone-900">
              {blockTarget.type === "slot" ? "Block Visit Slot" : "Block Full Day for Executive"}
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              {blockTarget.type === "slot"
                ? `Temporarily marks slot (${blockTarget.timeLabel || "selected time"}) unavailable for AI assistant bookings.`
                : `Marks all unbooked slots on ${blockTarget.dateIST} unavailable.`}
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-stone-700">
                Reason for blocking (optional)
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Sales training, doctor visit, personal leave"
                className="w-full text-xs border border-stone-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E3D]"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsBlockModalOpen(false);
                  setBlockTarget(null);
                  setBlockReason("");
                }}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="px-4 py-1.5 rounded-lg bg-[#1F4E3D] text-white text-xs font-medium hover:bg-[#16382c]"
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Executive Coverage Editor */}
      {isCoverageOpen && coverageData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-stone-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-lg font-serif font-bold text-stone-900">
                Executive Project Coverage
              </h3>
              <button
                onClick={() => setIsCoverageOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Configure which residential development projects each sales executive attends visits for.
            </p>

            <div className="mt-4 divide-y divide-stone-100">
              {coverageData.executives.map((exec) => (
                <div key={exec.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-stone-900">{exec.name}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    {coverageData.projects.map((proj) => {
                      const isAssigned = exec.assignedProjectIds.includes(proj.id);
                      return (
                        <label key={proj.id} className="inline-flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={(e) => {
                              const newIds = e.target.checked
                                ? [...exec.assignedProjectIds, proj.id]
                                : exec.assignedProjectIds.filter((pid) => pid !== proj.id);
                              handleSaveCoverage(exec.id, newIds);
                            }}
                            className="rounded text-[#1F4E3D] focus:ring-[#1F4E3D]"
                          />
                          <span>{proj.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setIsCoverageOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Project Location & Google Maps Pin */}
      {isLocationModalOpen && editingProject && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-serif font-bold text-stone-900">
              Edit Project Location & Pin
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Project: <span className="font-semibold text-stone-800">{editingProject.name}</span>.
              Coordinates and physical address are embedded in WhatsApp site-visit reminders and Google Maps navigation pins.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Project Address</label>
                <textarea
                  rows={2}
                  value={editingProject.address}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, address: e.target.value })
                  }
                  className="w-full text-xs border border-stone-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E3D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editingProject.lat}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, lat: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full text-xs border border-stone-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#1F4E3D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editingProject.lng}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, lng: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full text-xs border border-stone-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#1F4E3D]"
                  />
                </div>
              </div>

              {/* Live Maps Preview Link */}
              <div className="pt-2">
                <a
                  href={`https://maps.google.com/?q=${editingProject.lat},${editingProject.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 hover:text-emerald-900 underline font-medium inline-flex items-center gap-1"
                >
                  &rarr; Verify Pin in Google Maps ({editingProject.lat}, {editingProject.lng})
                </a>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsLocationModalOpen(false);
                  setEditingProject(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProjectLocation}
                className="px-4 py-1.5 rounded-lg bg-[#1F4E3D] text-white text-xs font-medium hover:bg-[#16382c]"
              >
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Idempotent Slot Generator Sub-Component Modal
 */
function GenerateSlotsModal({
  projects,
  executives,
  onClose,
  onSuccess,
}: {
  projects: ProjectOption[];
  executives: ExecutiveOption[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [selectedExecs, setSelectedExecs] = useState<string[]>(executives.map((e) => e.id));
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (selectedExecs.length === 0) {
        throw new Error("Please select at least one sales executive.");
      }

      const res = await fetch("/api/admin/slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          executiveIds: selectedExecs,
          startDate,
          endDate,
          daysOfWeek: [1, 2, 3, 4, 5, 6], // Mon-Sat
          startHourIST: 10,
          endHourIST: 18,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Slot generation failed");
      }

      onSuccess(json.message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error generating slots");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200">
        <h3 className="text-lg font-serif font-bold text-stone-900">
          Generate Visit Slots (Idempotent)
        </h3>
        <p className="text-xs text-stone-500 mt-1">
          Creates 60-minute appointment slots (10:00 to 18:00 IST, Mon–Sat). Uses database-level
          uniqueness to ensure existing slots are never duplicated.
        </p>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl mt-3">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleGenerate} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full text-xs border border-stone-300 rounded-lg p-2 focus:ring-1 focus:ring-[#1F4E3D]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.locationName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-stone-700">Sales Executives</label>
              <button
                type="button"
                onClick={() =>
                  setSelectedExecs(
                    selectedExecs.length === executives.length ? [] : executives.map((e) => e.id)
                  )
                }
                className="text-[11px] text-stone-500 hover:text-stone-900 underline"
              >
                {selectedExecs.length === executives.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2 border border-stone-200 rounded-lg bg-stone-50/50 max-h-32 overflow-y-auto">
              {executives.map((ex) => (
                <label key={ex.id} className="inline-flex items-center gap-1.5 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={selectedExecs.includes(ex.id)}
                    onChange={(e) => {
                      setSelectedExecs(
                        e.target.checked
                          ? [...selectedExecs, ex.id]
                          : selectedExecs.filter((id) => id !== ex.id)
                      );
                    }}
                    className="rounded text-[#1F4E3D] focus:ring-[#1F4E3D]"
                  />
                  <span className="truncate">{ex.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full text-xs border border-stone-300 rounded-lg p-2 focus:ring-1 focus:ring-[#1F4E3D]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full text-xs border border-stone-300 rounded-lg p-2 focus:ring-1 focus:ring-[#1F4E3D]"
              />
            </div>
          </div>

          <div className="text-[11px] text-stone-500 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
            Slots generated: <strong>10:00 AM to 6:00 PM IST</strong> (last slot starts 5:00 PM), Monday to Saturday.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-[#1F4E3D] text-white text-xs font-medium hover:bg-[#16382c] disabled:opacity-50"
            >
              {isSubmitting ? "Generating..." : "Generate Slots"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
