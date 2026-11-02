import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { leadService } from "@/server/services/leads";

export async function POST(
  _request: NextRequest,
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
    const updated = await leadService.unlinkDuplicate(id);

    if (!updated) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead: updated,
    });
  } catch (error) {
    console.error("Unlink duplicate error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
