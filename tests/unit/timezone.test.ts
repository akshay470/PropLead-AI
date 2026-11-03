import { describe, it, expect } from "vitest";
import {
  BUSINESS_TIMEZONE,
  createIstDate,
  getIstParts,
  getIstStartOfDay,
  getIstTomorrow,
  formatIstDate,
  formatIstTime,
  formatIstDateTime,
  formatIstDateKey,
  calculateReminderTimes,
  formatUtcForIcs,
} from "@/lib/timezone";

describe("Asia/Kolkata Business Timezone Standard & Determinism", () => {
  it("enforces Asia/Kolkata as the business timezone constant", () => {
    expect(BUSINESS_TIMEZONE).toBe("Asia/Kolkata");
  });

  it("createIstDate maps 10:00 IST to exactly 04:30:00.000Z", () => {
    const slotStart = createIstDate(2026, 11, 4, 10, 0, 0);
    expect(slotStart.toISOString()).toBe("2026-11-04T04:30:00.000Z");
  });

  it("createIstDate maps 18:00 IST to exactly 12:30:00.000Z", () => {
    const slotEnd = createIstDate(2026, 11, 4, 18, 0, 0);
    expect(slotEnd.toISOString()).toBe("2026-11-04T12:30:00.000Z");
  });

  it("getIstParts extracts correct IST year, month, day, hour, minute", () => {
    const utcDate = new Date("2026-11-04T04:30:00.000Z");
    const parts = getIstParts(utcDate);

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(11);
    expect(parts.day).toBe(4);
    expect(parts.hour).toBe(10);
    expect(parts.minute).toBe(0);
  });

  it("formatIstTime formats 04:30 UTC as 10:00 AM regardless of machine timezone", () => {
    const utcDate = new Date("2026-11-04T04:30:00.000Z");
    const formatted = formatIstTime(utcDate);
    expect(formatted).toMatch(/10:00\s*(am|AM)/);
  });

  it("formatIstDate formats date consistently in Indian English", () => {
    const utcDate = new Date("2026-11-04T04:30:00.000Z");
    const formatted = formatIstDate(utcDate);
    expect(formatted).toContain("4");
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("2026");
  });

  it("formatIstDateTime appends IST suffix and correct hours", () => {
    const utcDate = new Date("2026-11-04T05:30:00.000Z"); // 11:00 AM IST
    const formatted = formatIstDateTime(utcDate);
    expect(formatted).toContain("IST");
    expect(formatted).toMatch(/11:00\s*(am|AM)/);
  });

  it("formatIstDateKey returns YYYY-MM-DD in IST", () => {
    // 2026-11-03T19:00:00.000Z is 2026-11-04 00:30 AM in IST (next day in IST!)
    const lateUtc = new Date("2026-11-03T19:00:00.000Z");
    expect(formatIstDateKey(lateUtc)).toBe("2026-11-04");
  });

  it("getIstTomorrow computes tomorrow 11:00 AM IST deterministically", () => {
    const fixedNow = new Date("2026-11-04T05:00:00.000Z"); // Nov 4, 10:30 AM IST
    const tomorrow11am = getIstTomorrow(11, 0, fixedNow);
    // Tomorrow Nov 5, 11:00 AM IST -> 05:30:00.000Z
    expect(tomorrow11am.toISOString()).toBe("2026-11-05T05:30:00.000Z");
  });

  it("getIstStartOfDay returns 00:00:00 IST as UTC", () => {
    const ref = new Date("2026-11-04T12:00:00.000Z"); // Nov 4, 17:30 IST
    const startOfDay = getIstStartOfDay(ref);
    // Nov 4 00:00 IST -> Nov 3 18:30 UTC
    expect(startOfDay.toISOString()).toBe("2026-11-03T18:30:00.000Z");
  });

  it("calculateReminderTimes calculates exactly 24h and 2h before startsAt", () => {
    const slot = new Date("2026-11-06T05:30:00.000Z"); // Nov 6, 11:00 AM IST
    const now = new Date("2026-11-04T05:30:00.000Z"); // Nov 4, 11:00 AM IST (48h before)

    const res = calculateReminderTimes(slot, now);
    expect(res.reminder24h.toISOString()).toBe("2026-11-05T05:30:00.000Z");
    expect(res.reminder2h.toISOString()).toBe("2026-11-06T03:30:00.000Z");
    expect(res.is24hEligible).toBe(true);
    expect(res.is2hEligible).toBe(true);
  });

  it("formatUtcForIcs formats RFC 5545 UTC timestamp", () => {
    const d = new Date("2026-11-04T05:30:00.000Z");
    expect(formatUtcForIcs(d)).toBe("20261104T053000Z");
  });

  // Timezone environment insensitivity test: assert identical outputs under TZ=UTC and TZ=Asia/Kolkata
  describe("Timezone Environment Insensitivity (TZ=UTC vs TZ=Asia/Kolkata)", () => {
    const originalTz = process.env.TZ;

    it("produces identical slot timestamps under TZ=UTC and TZ=Asia/Kolkata", () => {
      process.env.TZ = "UTC";
      const slotUtcMode = createIstDate(2026, 11, 4, 10, 0, 0);
      const timeUtcMode = formatIstTime(slotUtcMode);
      const dateUtcMode = formatIstDate(slotUtcMode);

      process.env.TZ = "Asia/Kolkata";
      const slotIstMode = createIstDate(2026, 11, 4, 10, 0, 0);
      const timeIstMode = formatIstTime(slotIstMode);
      const dateIstMode = formatIstDate(slotIstMode);

      process.env.TZ = originalTz; // restore

      expect(slotUtcMode.getTime()).toBe(slotIstMode.getTime());
      expect(timeUtcMode).toBe(timeIstMode);
      expect(dateUtcMode).toBe(dateIstMode);
    });
  });
});
