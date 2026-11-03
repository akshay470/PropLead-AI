/**
 * Business Timezone Utilities for PropLead AI
 *
 * Statutory and operational standard: All developer and site-visit operations
 * occur in Ahmedabad, Gujarat, India (Asia/Kolkata, IST = UTC+05:30).
 *
 * Database stores UTC timestamps; all conversions, slot boundaries (10:00 to 18:00 IST),
 * reminder intervals, and user-facing displays are strictly computed in Asia/Kolkata.
 */

export const BUSINESS_TIMEZONE = "Asia/Kolkata";
export const IST_OFFSET_MINUTES = 330; // +05:30 in minutes (5 hours * 60 + 30)
export const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

/**
 * Creates a UTC Date object corresponding to a specific calendar date and time in Asia/Kolkata.
 * Example: createIstDate(2026, 11, 4, 10, 0) -> UTC Date for Nov 4, 2026, 10:00 AM IST (04:30:00.000Z).
 *
 * Note: month is 1-indexed (1 = Jan, 11 = Nov, 12 = Dec) for clarity.
 */
export function createIstDate(
  year: number,
  month1Indexed: number,
  day: number,
  hourIST = 0,
  minuteIST = 0,
  secondIST = 0
): Date {
  // Construct UTC timestamp by subtracting IST offset (+05:30)
  const utcMillis =
    Date.UTC(year, month1Indexed - 1, day, hourIST, minuteIST, secondIST) - IST_OFFSET_MS;
  return new Date(utcMillis);
}

/**
 * Extracts calendar date and time components of a Date in Asia/Kolkata.
 */
export function getIstParts(date: Date | string | number) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10); // 1-indexed
  const day = parseInt(partMap.day, 10);
  let hour = parseInt(partMap.hour, 10);
  if (hour === 24) hour = 0; // Some engines return 24 for midnight
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);
  const weekday = partMap.weekday; // 'Sun', 'Mon', etc.

  return { year, month, day, hour, minute, second, weekday };
}

/**
 * Returns the start of the day (00:00:00 IST) for a given date in Asia/Kolkata as a UTC Date.
 */
export function getIstStartOfDay(date: Date | string | number = new Date()): Date {
  const { year, month, day } = getIstParts(date);
  return createIstDate(year, month, day, 0, 0, 0);
}

/**
 * Returns the end of the day (23:59:59.999 IST) for a given date in Asia/Kolkata as a UTC Date.
 */
export function getIstEndOfDay(date: Date | string | number = new Date()): Date {
  const { year, month, day } = getIstParts(date);
  const nextDayStart = createIstDate(year, month, day + 1, 0, 0, 0);
  return new Date(nextDayStart.getTime() - 1);
}

/**
 * Returns tomorrow's date at a specific hour and minute in Asia/Kolkata as a UTC Date.
 * Independent of the host machine's timezone.
 */
export function getIstTomorrow(hourIST = 11, minuteIST = 0, referenceDate = new Date()): Date {
  const { year, month, day } = getIstParts(referenceDate);
  return createIstDate(year, month, day + 1, hourIST, minuteIST, 0);
}

/**
 * Returns a date relative to reference in days, set to specific hourIST and minuteIST.
 */
export function getIstRelativeDays(
  daysOffset: number,
  hourIST = 10,
  minuteIST = 0,
  referenceDate = new Date()
): Date {
  const { year, month, day } = getIstParts(referenceDate);
  return createIstDate(year, month, day + daysOffset, hourIST, minuteIST, 0);
}

/**
 * Returns YYYY-MM-DD string in Asia/Kolkata.
 */
export function formatIstDateKey(date: Date | string | number): string {
  const { year, month, day } = getIstParts(date);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Formats a Date into standard Indian English date string (e.g. "Wed, 4 Nov 2026").
 */
export function formatIstDate(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Formats a Date into standard Indian English time string (e.g. "10:00 AM").
 */
export function formatIstTime(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Formats a Date into standard Indian English date & time string (e.g. "Wed, 4 Nov 2026, 11:00 AM IST").
 */
export function formatIstDateTime(date: Date | string | number): string {
  return `${formatIstDate(date)}, ${formatIstTime(date)} IST`;
}

/**
 * Formats a slot range into concise IST time (e.g. "10:00 AM – 11:00 AM IST").
 */
export function formatIstSlotRange(
  startsAt: Date | string | number,
  endsAt: Date | string | number
): string {
  return `${formatIstTime(startsAt)} – ${formatIstTime(endsAt)} IST`;
}

/**
 * Computes Monday (start of week) in Asia/Kolkata for a given reference date.
 */
export function getIstMondayOfWeek(referenceDate = new Date()): Date {
  const parts = getIstParts(referenceDate);
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = weekdayMap[parts.weekday] ?? 0;
  return getIstRelativeDays(-offset, 0, 0, referenceDate);
}

/**
 * Computes exact reminder times for a site visit slot:
 * - 24 hours before startsAt
 * - 2 hours before startsAt
 * Returns timestamps and eligibility flags based on current time (now).
 */
export function calculateReminderTimes(
  startsAt: Date,
  now = new Date()
) {
  const slotMillis = startsAt.getTime();
  const nowMillis = now.getTime();

  const reminder24h = new Date(slotMillis - 24 * 60 * 60 * 1000);
  const reminder2h = new Date(slotMillis - 2 * 60 * 60 * 1000);

  // Eligible if the reminder timestamp is in the future relative to booking creation
  const is24hEligible = reminder24h.getTime() > nowMillis;
  const is2hEligible = reminder2h.getTime() > nowMillis;

  return {
    reminder24h,
    reminder2h,
    is24hEligible,
    is2hEligible,
  };
}

/**
 * Formats a Date into iCalendar (RFC 5545) UTC format: YYYYMMDDTHHMMSSZ.
 */
export function formatUtcForIcs(date: Date): string {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
