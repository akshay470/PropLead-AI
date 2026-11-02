import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { leadService } from "@/server/services/leads";
import { z } from "zod";

const assignSchema = z.object({
  executiveId: z.string().uuid().nullable(),
});

export async function PATCH(
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
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing lead ID" }, { status: 400 });
  }

  try {
    const json = await request.json();
    const parsed = assignSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await leadService.assignExecutive(id, parsed.data.executiveId);

    if (!updated) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead: updated,
    });
  } catch (error) {
    console.error("Assign lead error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
