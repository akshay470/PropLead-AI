import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { slotManagementService } from "@/server/services/booking/slot-management";

/**
 * GET /api/admin/slots
 * Retrieves the 7-day appointment grid in Asia/Kolkata, filtered by project or executive.
 * Role protected: Admin (Sales Head) only.
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
    const projectId = searchParams.get("projectId") || undefined;
    const executiveId = searchParams.get("executiveId") || undefined;
    const weekStartIST = searchParams.get("weekStartIST") || undefined;

    const data = await slotManagementService.getWeekSlotsGrid({
      projectId,
      executiveId,
      weekStartIST,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("GET /api/admin/slots error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load slots schedule" },
      { status: 500 }
    );
  }
}
