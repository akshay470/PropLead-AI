import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { slotManagementService } from "@/server/services/booking/slot-management";
import { z } from "zod";

const generateSlotsSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  executiveIds: z.array(z.string().uuid("Invalid executive ID")).min(1, "Select at least one executive"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startHourIST: z.number().int().min(6).max(20).default(10),
  endHourIST: z.number().int().min(7).max(22).default(18),
});

/**
 * POST /api/admin/slots/generate
 * Generates 60-minute visit slots idempotently.
 * Uses ON CONFLICT DO NOTHING to ensure re-running does not produce duplicate slots.
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
    const parsed = generateSlotsSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await slotManagementService.generateSlots(parsed.data);

    return NextResponse.json({
      success: true,
      message: `Generated ${result.createdCount} new slots (${result.skippedCount} existing slots retained without duplication).`,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/admin/slots/generate error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate visit slots",
      },
      { status: 500 }
    );
  }
}
