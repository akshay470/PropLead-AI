import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { anonymizeLead } from "@/server/services/leads";

/**
 * POST /api/admin/leads/[id]/anonymize
 * DPDP Act 2023 Compliance: Anonymize lead PII and scrub conversation contents.
 * Protected: Admin (Sales Head) only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Lead ID parameter is required" },
        { status: 400 }
      );
    }

    const result = await anonymizeLead(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Lead not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lead data anonymized per DPDP request",
      leadId: result.leadId,
    });
  } catch (error) {
    console.error("POST /api/admin/leads/[id]/anonymize error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
