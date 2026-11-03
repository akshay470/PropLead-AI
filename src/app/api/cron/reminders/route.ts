import { NextRequest, NextResponse } from "next/server";
import { reminderService } from "@/server/services/reminders/dispatcher";
import { env } from "@/env";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const cronSecret = env.CRON_SECRET;

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  const providedSecret = bearerToken || cronHeader;

  if (!providedSecret || providedSecret !== cronSecret) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid CRON_SECRET" },
      { status: 401 }
    );
  }

  try {
    const result = await reminderService.dispatchDueReminders();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Cron reminders error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
