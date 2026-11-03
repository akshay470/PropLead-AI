import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { conversations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const markReviewedSchema = z.object({
  reviewNotes: z.string().max(2000).optional(),
});

/**
 * POST /api/admin/review/[id]
 * Marks a flagged conversation as reviewed with optional administrative notes.
 */
export async function POST(
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
        { success: false, error: "Forbidden: Sales Head privileges required" },
        { status: 403 }
      );
    }

    const json = await request.json().catch(() => ({}));
    const parsed = markReviewedSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { reviewNotes } = parsed.data;

    const [updated] = await db
      .update(conversations)
      .set({
        reviewedAt: new Date(),
        reviewedById: user.userId,
        reviewNotes: reviewNotes || "Reviewed and approved by Sales Head.",
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation: updated,
    });
  } catch (error) {
    console.error("POST /api/admin/review/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark reviewed" },
      { status: 500 }
    );
  }
}
