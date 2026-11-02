"use client";

import { useState, useMemo } from "react";
import { FreeSlot } from "@/server/services/booking/types";

interface SlotPickerProps {
  slots: FreeSlot[];
  selectedSlotId?: string | null;
  onSelectSlot: (slot: FreeSlot) => void;
  isLoading?: boolean;
}

export function SlotPicker({
  slots,
  selectedSlotId,
  onSelectSlot,
  isLoading = false,
}: SlotPickerProps) {
  // Group slots by Day string: "YYYY-MM-DD"
  const slotsByDate = useMemo(() => {
    const map = new Map<string, { date: Date; dateLabel: string; dayLabel: string; slots: FreeSlot[] }>();

    for (const slot of slots) {
      const d = new Date(slot.startsAt);
      const key = d.toISOString().split("T")[0];

      if (!map.has(key)) {
        map.set(key, {
          date: d,
          dateLabel: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          dayLabel: d.toLocaleDateString("en-IN", { weekday: "short" }),
          slots: [],
        });
      }
      map.get(key)!.slots.push(slot);
    }

    // Sort slots within each day by start time
    for (const entry of map.values()) {
      entry.slots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }

    return Array.from(map.entries()).sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [slots]);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    slotsByDate[0]?.[0] || ""
  );

  // If selectedDateKey is not set yet, set it to the first available date
  const activeDateKey =
    selectedDateKey && slotsByDate.some(([key]) => key === selectedDateKey)
      ? selectedDateKey
      : slotsByDate[0]?.[0] || "";

  const activeDayEntry = slotsByDate.find(([key]) => key === activeDateKey)?.[1];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 w-20 flex-shrink-0 animate-pulse rounded-xl border border-surface-300 bg-surface-100"
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg border border-surface-300 bg-surface-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-6 text-center text-xs text-ink-500">
        No visit slots are currently available for this project. Please check back shortly or request an executive callback.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Date Selector (Horizontal scrollable pills) */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
          1. Select Preferred Date
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {slotsByDate.map(([dateKey, dayData]) => {
            const isSelected = dateKey === activeDateKey;
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDateKey(dateKey)}
                className={`flex flex-col items-center justify-center min-w-[4.75rem] px-3 py-2.5 rounded-xl border text-center transition-all ${
                  isSelected
                    ? "border-brand-600 bg-brand-50 text-brand-900 shadow-subtle ring-1 ring-brand-500"
                    : "border-surface-300 bg-surface-50 text-ink-700 hover:border-surface-400 hover:bg-surface-100"
                }`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-75">
                  {dayData.dayLabel}
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  {dayData.dateLabel}
                </span>
                <span className="text-[9px] mt-0.5 text-brand-700 font-medium">
                  {dayData.slots.length} free
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Time Slot Grid (Calm pill buttons, taken slots hidden) */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
          2. Select 1-Hour Time Window
        </label>
        {activeDayEntry && activeDayEntry.slots.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {activeDayEntry.slots.map((slot) => {
              const isSelected = slot.id === selectedSlotId;
              const startTime = new Date(slot.startsAt).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });
              const endTime = new Date(slot.endsAt).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });

              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelectSlot(slot)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    isSelected
                      ? "border-ink-900 bg-ink-900 text-surface-50 shadow-card"
                      : "border-surface-300 bg-surface-50 text-ink-900 hover:border-brand-500 hover:bg-surface-100"
                  }`}
                >
                  <span className="text-xs font-semibold">{startTime}</span>
                  <span
                    className={`text-[10px] ${
                      isSelected ? "text-surface-300" : "text-ink-400"
                    }`}
                  >
                    until {endTime}
                  </span>
                  {slot.executiveFirstName && (
                    <span
                      className={`text-[9px] mt-1 uppercase tracking-wider ${
                        isSelected ? "text-accent-subtle" : "text-brand-600"
                      }`}
                    >
                      Host: {slot.executiveFirstName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-surface-300 bg-surface-50 p-4 text-center text-xs text-ink-400">
            No remaining slots available for this day.
          </div>
        )}
      </div>
    </div>
  );
}
