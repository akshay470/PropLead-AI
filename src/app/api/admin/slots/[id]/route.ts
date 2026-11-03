import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { slotManagementService } from "@/server/services/booking/slot-management";

/**
 * DELETE /api/admin/slots/[id]
 * Deletes an unbooked visit slot.
 * Rejects deletion if a confirmed booking is attached to prevent orphaned bookings.
 * Role protected: Admin only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing slot ID" }, { status: 400 });
    }

    const result = await slotManagementService.deleteSlot(id);

    return NextResponse.json({
      success: true,
      message: "Slot successfully deleted",
      slotId: result.slotId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete slot";
    const status = message.includes("Confirmed booking exists") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
