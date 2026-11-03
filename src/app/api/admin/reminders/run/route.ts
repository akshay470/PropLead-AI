import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { reminderService } from "@/server/services/reminders/dispatcher";

/**
 * POST /api/admin/reminders/run
 * On-demand manual trigger for processing and sending due visit reminders.
 * Admin (Sales Head) only. Used for live demonstrations and fallback operations.
 */
export async function POST() {
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

    const result = await reminderService.dispatchDueReminders();
    return NextResponse.json({
      success: true,
      message: "Due reminders processed successfully",
      ...result,
    });
  } catch (error) {
    console.error("POST /api/admin/reminders/run error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to dispatch reminders" },
      { status: 500 }
    );
  }
}
