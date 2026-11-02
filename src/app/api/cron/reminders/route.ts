import { NextRequest, NextResponse } from "next/server";
import { reminderService } from "@/server/services/reminders/dispatcher";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET || "demo_cron_secret_minimum_32_bytes";

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
