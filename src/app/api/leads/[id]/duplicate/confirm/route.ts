import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { leadService } from "@/server/services/leads";
import { z } from "zod";

const confirmDuplicateSchema = z.object({
  canonicalLeadId: z.string().uuid("Invalid canonical lead ID"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "executive" && user.role !== "admin" && !user.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Executive or Admin access required" },
      { status: 403 }
    );
  }

  const { id } = params;

  try {
    const json = await request.json();
    const parsed = confirmDuplicateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await leadService.confirmDuplicate(id, parsed.data.canonicalLeadId);

    if (!updated) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead: updated,
    });
  } catch (error) {
    console.error("Confirm duplicate error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}
