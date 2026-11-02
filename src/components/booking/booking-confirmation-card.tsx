"use client";

import { useState } from "react";

export interface BookingConfirmationProps {
  bookingId: string;
  leadName: string;
  projectName: string;
  projectAddress?: string | null;
  projectLat?: number | null;
  projectLng?: number | null;
  projectRera?: string | null;
  startsAt: string | Date;
  endsAt: string | Date;
  executiveName?: string | null;
  executivePhone?: string | null;
  leadCode?: string;
  onDone?: () => void;
}

export function BookingConfirmationCard({
  bookingId,
  leadName,
  projectName,
  projectAddress,
  projectLat,
  projectLng,
  projectRera,
  startsAt,
  endsAt,
  executiveName,
  executivePhone,
  leadCode,
  onDone,
}: BookingConfirmationProps) {
  const [downloaded, setDownloaded] = useState(false);

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  const formattedDate = startDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedStartTime = startDate.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const formattedEndTime = endDate.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Google Maps navigation link
  const mapsUrl =
    projectLat && projectLng
      ? `https://www.google.com/maps/search/?api=1&query=${projectLat},${projectLng}`
      : projectAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${projectName}, ${projectAddress}`
        )}`
      : null;

  // Generate and trigger download of .ics calendar file
  const handleDownloadIcs = () => {
    const formatUtc = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const title = `Site Visit: ${projectName} - PropLead AI`;
    const location = projectAddress || projectName;
    const description = [
      `Site visit booked for ${leadName}${leadCode ? ` (${leadCode})` : ""}`,
      `Project: ${projectName}`,
      executiveName ? `Dedicated Executive: ${executiveName}` : "",
      projectRera ? `RERA Reg: ${projectRera}` : "",
      "Please arrive 10 minutes prior to your scheduled time.",
      "Booked via PropLead AI.",
    ]
      .filter(Boolean)
      .join("\n");

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PropLead AI//Site Visit Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:proplead-${bookingId}@proplead.ai`,
      `DTSTAMP:${formatUtc(new Date())}`,
      `DTSTART:${formatUtc(startDate)}`,
      `DTEND:${formatUtc(endDate)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const blob = new Blob([icsLines.join("\r\n")], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `site-visit-${projectName.toLowerCase().replace(/\s+/g, "-")}-${startDate
        .toISOString()
        .slice(0, 10)}.ics`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="rounded-2xl border border-surface-300 bg-white p-6 shadow-sm transition-all sm:p-8">
      {/* Header with verified checkmark */}
      <div className="flex items-start justify-between gap-4 border-b border-surface-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <span className="inline-block rounded bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
              Confirmed Slot
            </span>
            <h2 className="text-lg font-serif font-bold text-ink-900 sm:text-xl">
              Site Visit Booked
            </h2>
          </div>
        </div>
        {leadCode && (
          <span className="font-mono text-xs font-semibold text-ink-500">
            {leadCode}
          </span>
        )}
      </div>

      {/* Appointment Summary Box */}
      <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-ink-500">Scheduled Date & Time</div>
            <div className="mt-0.5 text-base font-semibold text-ink-900 sm:text-lg">
              {formattedDate}
            </div>
            <div className="text-sm font-medium text-primary-800">
              {formattedStartTime} – {formattedEndTime} (60 mins)
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="mt-6 grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
        {/* Project & Address */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Project & Location
          </div>
          <div className="mt-1 font-semibold text-ink-900">{projectName}</div>
          {projectAddress && (
            <div className="mt-0.5 text-xs leading-relaxed text-ink-600">
              {projectAddress}
            </div>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 hover:underline"
            >
              <svg
                className="h-3.5 w-3.5 text-primary-600"
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
              Open in Google Maps
            </a>
          )}
        </div>

        {/* Sales Executive */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Assigned Sales Executive
          </div>
          <div className="mt-1 font-semibold text-ink-900">
            {executiveName || "Project Sales Team"}
          </div>
          <div className="mt-0.5 text-xs text-ink-500">
            Will welcome you at the experience gallery
          </div>
          {executivePhone && (
            <a
              href={`tel:${executivePhone}`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 hover:underline"
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
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              Call Executive
            </a>
          )}
        </div>
      </div>

      {/* RERA Badge & Statutory Compliance */}
      {projectRera && (
        <div className="mt-5 rounded-lg border border-surface-200 bg-surface-50 p-3 text-xs text-ink-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-800">Gujarat RERA Reg:</span>
            <span className="font-mono text-primary-700">{projectRera}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            Official details and sanctions can be verified on gujrera.gujarat.gov.in.
            Company A complies with Gujarat RERA regulations.
          </p>
        </div>
      )}

      {/* DPDP Act 2023 Notice & Reminder Policy */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-surface-200 bg-surface-50/60 p-3 text-xs text-ink-500">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-ink-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          Under DPDP Act 2023, automated reminders will be delivered 1 day and 2 hours
          prior to your appointment. You can reply <strong>STOP</strong> at any time to
          opt out.
        </span>
      </div>

      {/* Action Buttons: Add to Calendar & Done */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-surface-200">
        <button
          type="button"
          onClick={handleDownloadIcs}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-300 bg-white px-4 py-2 text-xs font-semibold text-ink-700 shadow-sm transition hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <svg
            className="h-4 w-4 text-ink-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {downloaded ? "Added to Calendar!" : "Add to Calendar (.ics)"}
        </button>

        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg bg-primary-600 px-5 py-2 text-xs font-semibold text-white shadow transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
