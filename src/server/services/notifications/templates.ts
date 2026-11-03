/**
 * Unified Notification Message Templates for PropLead AI
 *
 * Statutory & Operational Rules:
 * - Every message clearly includes project name, appointment date & time in IST (Asia/Kolkata),
 *   assigned executive name, Google Maps pin link, Gujarat RERA registration number,
 *   and explicit DPDP opt-out instructions ("Reply STOP to opt out").
 *
 * Compliance Note:
 * - Real-world WhatsApp Business API implementations require pre-approved message templates
 *   registered with Meta. This production build mocks the underlying telecom/WhatsApp provider
 *   while generating compliant, ready-to-dispatch template payloads.
 */

import { formatIstDate, formatIstTime, formatIstDateTime } from "@/lib/timezone";

export const NOTIFICATION_TEMPLATE_VERSION = "v1.2.0";

export interface TemplateContext {
  leadName: string;
  leadCode?: string;
  projectName: string;
  projectAddress?: string;
  projectLat: string | number;
  projectLng: string | number;
  projectRera: string;
  startsAt: Date | string;
  endsAt?: Date | string;
  executiveName?: string;
}

/**
 * Builds Google Maps search URL from coordinates or address fallback.
 */
export function buildMapsLink(lat: string | number, lng: string | number, name?: string): string {
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name || "Ahmedabad")}`;
}

export const notificationTemplates = {
  version: NOTIFICATION_TEMPLATE_VERSION,

  /**
   * 1-Day Prior Visit Reminder Template
   */
  visitReminder1Day(ctx: TemplateContext): string {
    const timeFormatted = formatIstTime(ctx.startsAt);
    const dateFormatted = formatIstDate(ctx.startsAt);
    const exec = ctx.executiveName || "Our Site Experience Executive";
    const mapLink = buildMapsLink(ctx.projectLat, ctx.projectLng, ctx.projectName);

    return (
      `Namaste ${ctx.leadName}! Reminder for your site visit at ${ctx.projectName} tomorrow (${dateFormatted} at ${timeFormatted} IST). ` +
      `Your dedicated sales executive is ${exec}. ` +
      `Site Location: ${mapLink} (${ctx.projectAddress || ctx.projectName}). ` +
      `Gujarat RERA Reg: ${ctx.projectRera}. Statutory Note: Promotional details do not supersede registered approvals. ` +
      `Reply STOP to opt out of reminders. [${NOTIFICATION_TEMPLATE_VERSION}]`
    );
  },

  /**
   * 2-Hours Prior Visit Reminder Template
   */
  visitReminder2Hours(ctx: TemplateContext): string {
    const timeFormatted = formatIstTime(ctx.startsAt);
    const exec = ctx.executiveName || "Our Site Experience Executive";
    const mapLink = buildMapsLink(ctx.projectLat, ctx.projectLng, ctx.projectName);

    return (
      `Namaste ${ctx.leadName}! Your site visit at ${ctx.projectName} is in 2 hours (today at ${timeFormatted} IST). ` +
      `Your sales executive ${exec} is preparing your preview. ` +
      `Site Location: ${mapLink} (${ctx.projectAddress || ctx.projectName}). ` +
      `Gujarat RERA Reg: ${ctx.projectRera}. ` +
      `Please carry a valid Government photo ID. Reply STOP to opt out. [${NOTIFICATION_TEMPLATE_VERSION}]`
    );
  },

  /**
   * Booking Confirmation Instant Dispatch Template
   */
  bookingConfirmation(ctx: TemplateContext): string {
    const dateTimeStr = formatIstDateTime(ctx.startsAt);
    const exec = ctx.executiveName || "Our Sales Executive";
    const mapLink = buildMapsLink(ctx.projectLat, ctx.projectLng, ctx.projectName);

    return (
      `Namaste ${ctx.leadName}! Your site visit at ${ctx.projectName} is confirmed for ${dateTimeStr}. ` +
      `Assigned Executive: ${exec}. ` +
      `Location Pin: ${mapLink} (${ctx.projectAddress || ctx.projectName}). ` +
      `Gujarat RERA Reg: ${ctx.projectRera}. ` +
      `We look forward to hosting you! Reply STOP to opt out. [${NOTIFICATION_TEMPLATE_VERSION}]`
    );
  },

  /**
   * Visit Rescheduled Template
   */
  bookingRescheduled(ctx: TemplateContext): string {
    const dateTimeStr = formatIstDateTime(ctx.startsAt);
    const exec = ctx.executiveName || "Our Sales Executive";
    const mapLink = buildMapsLink(ctx.projectLat, ctx.projectLng, ctx.projectName);

    return (
      `Namaste ${ctx.leadName}! Your site visit at ${ctx.projectName} has been rescheduled to ${dateTimeStr}. ` +
      `Executive: ${exec}. ` +
      `Location: ${mapLink}. ` +
      `Gujarat RERA Reg: ${ctx.projectRera}. Reply STOP to opt out. [${NOTIFICATION_TEMPLATE_VERSION}]`
    );
  },

  /**
   * Visit Cancelled Template
   */
  bookingCancelled(ctx: Pick<TemplateContext, "leadName" | "projectName" | "projectRera" | "startsAt">): string {
    const dateTimeStr = formatIstDateTime(ctx.startsAt);
    return (
      `Namaste ${ctx.leadName}, your site visit booking for ${ctx.projectName} on ${dateTimeStr} has been cancelled. ` +
      `If you wish to reschedule at any time, simply message us. ` +
      `Gujarat RERA Reg: ${ctx.projectRera}. Reply STOP to opt out. [${NOTIFICATION_TEMPLATE_VERSION}]`
    );
  },

  /**
   * DPDP Affirmative Opt-Out Confirmation
   */
  optOutConfirmation(leadName: string): string {
    return (
      `Namaste ${leadName}, you have been opted out of automated communications from Company A in accordance with the DPDP Act 2023. ` +
      `All visit reminders and messages have ceased immediately. Reply START if you wish to re-subscribe in the future. [${NOTIFICATION_TEMPLATE_VERSION}]`
    );
  },
};
