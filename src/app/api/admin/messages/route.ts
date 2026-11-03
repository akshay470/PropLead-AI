import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { messageLog } from "@/server/db/schema";
import { formatIstDateTime } from "@/lib/timezone";
import { maskRecipient } from "@/lib/phone";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/admin/messages
 * Read-only message_log viewer for administrators.
 * Returns outbound WhatsApp/SMS notifications with masked recipient privacy protection.
 * Role protected: Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Sales Head admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel") as "whatsapp" | "sms" | "email" | null;
    const status = searchParams.get("status") as "queued" | "sent" | "delivered" | "failed" | null;

    const conditions = [];
    if (channel) {
      conditions.push(eq(messageLog.channel, channel));
    }
    if (status) {
      conditions.push(eq(messageLog.status, status));
    }

    const rows = await db
      .select({
        id: messageLog.id,
        channel: messageLog.channel,
        to: messageLog.to,
        template: messageLog.template,
        body: messageLog.body,
        status: messageLog.status,
        createdAt: messageLog.createdAt,
      })
      .from(messageLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(messageLog.createdAt))
      .limit(100);

    const maskedMessages = rows.map((m) => ({
      id: m.id,
      channel: m.channel,
      maskedTo: maskRecipient(m.to),
      template: m.template,
      body: m.body,
      status: m.status,
      createdAtUtc: m.createdAt,
      createdAtIst: formatIstDateTime(m.createdAt),
    }));

    return NextResponse.json({
      success: true,
      messages: maskedMessages,
    });
  } catch (error) {
    console.error("GET /api/admin/messages error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load message audit logs" },
      { status: 500 }
    );
  }
}
