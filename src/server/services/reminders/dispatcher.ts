import { eq, and, lte } from "drizzle-orm";
import { db } from "../../db";
import {
  reminders,
  bookings,
  visitSlots,
  leads,
  projects,
  users,
} from "../../db/schema";
import { messageService } from "../message-service";

export interface DispatchRemindersResult {
  processed: number;
  sent: number;
  skippedOptedOut: number;
  skippedCancelled: number;
}

export const reminderService = {
  /**
   * Finds and dispatches all due visit reminders (scheduled_at <= now, status = 'pending').
   * Idempotent: Dispatched reminders are immediately transitioned to 'sent' or 'cancelled'.
   */
  async dispatchDueReminders(
    referenceTime: Date = new Date(),
    dbOrTx: typeof db = db
  ): Promise<DispatchRemindersResult> {
    const dueReminders = await dbOrTx
      .select({
        reminderId: reminders.id,
        reminderType: reminders.type,
        scheduledAt: reminders.scheduledAt,
        bookingId: bookings.id,
        bookingStatus: bookings.status,
        slotStartsAt: visitSlots.startsAt,
        slotEndsAt: visitSlots.endsAt,
        leadId: leads.id,
        leadName: leads.name,
        leadPhone: leads.phoneE164,
        leadOptedOut: leads.optedOut,
        projectName: projects.name,
        projectRera: projects.reraNumber,
        projectLat: projects.lat,
        projectLng: projects.lng,
        projectAddress: projects.address,
        executiveName: users.name,
      })
      .from(reminders)
      .innerJoin(bookings, eq(reminders.bookingId, bookings.id))
      .innerJoin(visitSlots, eq(bookings.slotId, visitSlots.id))
      .innerJoin(leads, eq(bookings.leadId, leads.id))
      .innerJoin(projects, eq(visitSlots.projectId, projects.id))
      .leftJoin(users, eq(visitSlots.executiveId, users.id))
      .where(
        and(
          eq(reminders.status, "pending"),
          lte(reminders.scheduledAt, referenceTime)
        )
      );

    let sent = 0;
    let skippedOptedOut = 0;
    let skippedCancelled = 0;

    for (const item of dueReminders) {
      // 1. Skip if lead opted out
      if (item.leadOptedOut) {
        await dbOrTx
          .update(reminders)
          .set({ status: "cancelled" })
          .where(eq(reminders.id, item.reminderId));
        skippedOptedOut++;
        continue;
      }

      // 2. Skip if booking is no longer confirmed
      if (item.bookingStatus !== "confirmed") {
        await dbOrTx
          .update(reminders)
          .set({ status: "cancelled" })
          .where(eq(reminders.id, item.reminderId));
        skippedCancelled++;
        continue;
      }

      // Format appointment time (IST)
      const slotTime = new Date(item.slotStartsAt);
      const timeStr = slotTime.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const dateStr = slotTime.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      const mapLink = `https://maps.google.com/?q=${item.projectLat},${item.projectLng}`;
      const execName = item.executiveName || "Site Host";
      const timingLabel = item.reminderType === "1_day" ? "tomorrow" : "in 2 hours";

      const messageBody =
        `Namaste ${item.leadName}! Reminder for your site visit at ${item.projectName} scheduled for ${timingLabel} (${dateStr} at ${timeStr}). ` +
        `Your dedicated sales executive is ${execName}. ` +
        `Site Location: ${mapLink} (${item.projectAddress}). ` +
        `Gujarat RERA Reg: ${item.projectRera}. No promotional claims supersede registered approvals. ` +
        `Reply STOP to opt out of reminders.`;

      // Dispatch via mocked message log
      await messageService.sendMessage(
        {
          channel: "whatsapp",
          to: item.leadPhone,
          template: `visit_reminder_${item.reminderType}`,
          body: messageBody,
        },
        dbOrTx
      );

      // Mark reminder as sent
      await dbOrTx
        .update(reminders)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(reminders.id, item.reminderId));

      sent++;
    }

    return {
      processed: dueReminders.length,
      sent,
      skippedOptedOut,
      skippedCancelled,
    };
  },
};
