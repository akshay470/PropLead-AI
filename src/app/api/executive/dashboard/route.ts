import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { dashboardService } from "@/server/services/analytics/dashboard";

/**
 * GET /api/executive/dashboard?days=7|30|90
 * Trimmed performance metrics for the logged-in sales executive:
 * Their assigned leads, median response latency, completed visits, and personal show-up rate.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "executive" && user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Sales Executive access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const validDays = [7, 30, 90].includes(days) ? days : 30;

    // Scoped strictly to logged in executive's ID
    const data = await dashboardService.getMetrics({
      days: validDays,
      executiveId: user.userId,
    });

    return NextResponse.json({
      success: true,
      executiveName: user.name,
      ...data,
    });
  } catch (error) {
    console.error("GET /api/executive/dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load executive metrics" },
      { status: 500 }
    );
  }
}
