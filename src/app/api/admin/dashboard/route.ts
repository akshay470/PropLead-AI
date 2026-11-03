import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { dashboardService } from "@/server/services/analytics/dashboard";

/**
 * GET /api/admin/dashboard?days=7|30|90
 * Full real-time developer metrics for Sales Head:
 * Response times vs baseline, unique leads, visits, show-up rates, spend & unit economics.
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
    const days = parseInt(searchParams.get("days") || "30", 10);
    const validDays = [7, 30, 90].includes(days) ? days : 30;

    const data = await dashboardService.getMetrics({ days: validDays });
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("GET /api/admin/dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
