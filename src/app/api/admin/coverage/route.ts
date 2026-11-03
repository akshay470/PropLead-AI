import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { slotManagementService } from "@/server/services/booking/slot-management";
import { z } from "zod";

const updateCoverageSchema = z.object({
  executiveId: z.string().uuid("Invalid executive ID"),
  projectIds: z.array(z.string().uuid("Invalid project ID")),
});

/**
 * GET /api/admin/coverage
 * Retrieves all sales executives and their assigned project coverages.
 * Role protected: Admin only.
 */
export async function GET() {
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

    const data = await slotManagementService.getExecutiveCoverage();

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("GET /api/admin/coverage error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load executive coverage assignments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/coverage
 * Updates project coverage assignments for a specific executive.
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
    const parsed = updateCoverageSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await slotManagementService.updateExecutiveCoverage(
      parsed.data.executiveId,
      parsed.data.projectIds
    );

    return NextResponse.json({
      message: "Executive project coverage updated successfully",
      ...result,
    });
  } catch (error) {
    console.error("POST /api/admin/coverage error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update coverage",
      },
      { status: 500 }
    );
  }
}
