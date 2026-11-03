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
import { notificationTemplates } from "../notifications/templates";

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

      // Build compliant reminder message from unified templates
      const templateCtx = {
        leadName: item.leadName,
        projectName: item.projectName,
        projectAddress: item.projectAddress,
        projectLat: item.projectLat,
        projectLng: item.projectLng,
        projectRera: item.projectRera,
        startsAt: item.slotStartsAt,
        endsAt: item.slotEndsAt,
        executiveName: item.executiveName || "Site Experience Host",
      };

      const messageBody =
        item.reminderType === "1_day"
          ? notificationTemplates.visitReminder1Day(templateCtx)
          : notificationTemplates.visitReminder2Hours(templateCtx);

      // 3. Atomic claim: Transition from 'pending' to 'sent' before message dispatch.
      // If a concurrent cron dispatcher already claimed this reminder, returning will be empty.
      const claimed = await dbOrTx
        .update(reminders)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(
          and(
            eq(reminders.id, item.reminderId),
            eq(reminders.status, "pending")
          )
        )
        .returning({ id: reminders.id });

      if (!claimed || claimed.length === 0) {
        continue; // Handled by concurrent runner
      }

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
