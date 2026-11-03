import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { slotManagementService } from "@/server/services/booking/slot-management";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateLocationSchema = z.object({
  address: z.string().min(5, "Address must be at least 5 characters").max(500),
  lat: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  lng: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
});

/**
 * GET /api/admin/projects/[id]/location
 * Role protected: Admin only.
 */
export async function GET(
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
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        locationName: projects.locationName,
        address: projects.address,
        lat: projects.lat,
        lng: projects.lng,
        reraNumber: projects.reraNumber,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("GET project location error:", error);
    return NextResponse.json({ success: false, error: "Failed to load project" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/projects/[id]/location
 * Updates address, latitude, and longitude for Google Maps site-visit navigation pins.
 * Role protected: Admin only.
 */
export async function PATCH(
  request: NextRequest,
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
    const json = await request.json();
    const parsed = updateLocationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await slotManagementService.updateProjectLocation(id, parsed.data);

    return NextResponse.json({
      success: true,
      message: "Project location and map pin updated successfully",
      project: updated,
    });
  } catch (error) {
    console.error("PATCH project location error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update project location",
      },
      { status: 500 }
    );
  }
}
