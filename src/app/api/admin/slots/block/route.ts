import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { slotManagementService } from "@/server/services/booking/slot-management";
import { z } from "zod";

const blockActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("block_slot"),
    slotId: z.string().uuid("Invalid slot ID"),
    reason: z.string().max(255).optional(),
  }),
  z.object({
    action: z.literal("unblock_slot"),
    slotId: z.string().uuid("Invalid slot ID"),
  }),
  z.object({
    action: z.literal("block_day"),
    executiveId: z.string().uuid("Invalid executive ID"),
    dateIST: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    reason: z.string().max(255).optional(),
  }),
]);

/**
 * POST /api/admin/slots/block
 * Manages blocked status on individual slots or full day schedules.
 * Prevents blocking slots with active confirmed bookings.
 * Role protected: Admin only.
 */
export async function POST(request: NextRequest) {
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

    const json = await request.json();
    const parsed = blockActionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.action === "block_slot") {
      const slot = await slotManagementService.blockSlot(data.slotId, data.reason);
      return NextResponse.json({
        success: true,
        message: "Slot successfully blocked",
        slot,
      });
    }

    if (data.action === "unblock_slot") {
      const slot = await slotManagementService.unblockSlot(data.slotId);
      return NextResponse.json({
        success: true,
        message: "Slot successfully unblocked",
        slot,
      });
    }

    if (data.action === "block_day") {
      const result = await slotManagementService.blockDay(
        data.executiveId,
        data.dateIST,
        data.reason
      );
      return NextResponse.json({
        success: true,
        message: `Blocked ${result.blockedCount} slots on ${result.dateIST}${
          result.skippedBookedCount > 0
            ? ` (${result.skippedBookedCount} booked slots were kept active)`
            : ""
        }`,
        ...result,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute slot block action";
    const status = message.includes("Confirmed booking exists") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
