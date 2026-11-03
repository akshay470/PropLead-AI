import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { handoffs, leads } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateHandoffSchema = z.object({
  status: z.enum(["open", "contacted", "resolved"]),
  notes: z.string().max(2000).optional(),
});

/**
 * PATCH /api/executive/handoffs/[id]
 * Updates a handoff status ("contacted" | "resolved") with an optional executive note.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "executive" && user.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const json = await request.json();
    const parsed = updateHandoffSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, notes } = parsed.data;

    // Check handoff existence & ownership
    const [existing] = await db
      .select()
      .from(handoffs)
      .where(eq(handoffs.id, params.id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Handoff record not found" },
        { status: 404 }
      );
    }

    if (user.role === "executive" && existing.executiveId !== user.userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only update your own assigned handoffs" },
        { status: 403 }
      );
    }

    const isResolved = status === "resolved";
    const [updated] = await db
      .update(handoffs)
      .set({
        status,
        notes: notes !== undefined ? notes : existing.notes,
        resolvedAt: isResolved ? new Date() : existing.resolvedAt,
      })
      .where(eq(handoffs.id, params.id))
      .returning();

    // If marked contacted, update lead status to 'contacted' if it was 'new'
    if (status === "contacted") {
      await db
        .update(leads)
        .set({ status: "contacted", updatedAt: new Date() })
        .where(and(eq(leads.id, existing.leadId), eq(leads.status, "new")));
    }

    return NextResponse.json({
      success: true,
      handoff: updated,
    });
  } catch (error) {
    console.error("PATCH /api/executive/handoffs/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update handoff" },
      { status: 500 }
    );
  }
}
