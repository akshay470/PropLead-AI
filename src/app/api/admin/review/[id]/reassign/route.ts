import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { conversations, handoffs, leads, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const reassignSchema = z.object({
  newExecutiveId: z.string().uuid("Invalid executive user ID"),
});

/**
 * POST /api/admin/review/[id]/reassign
 * Reassigns the flagged lead & handoff to another executive.
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

    const json = await request.json();
    const parsed = reassignSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { newExecutiveId } = parsed.data;

    // Verify target executive exists
    const [targetExec] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, newExecutiveId))
      .limit(1);

    if (!targetExec || (targetExec.role !== "executive" && targetExec.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "Target user is not an executive" },
        { status: 400 }
      );
    }

    // Find conversation to get leadId
    const [conv] = await db
      .select({ id: conversations.id, leadId: conversations.leadId })
      .from(conversations)
      .where(eq(conversations.id, params.id))
      .limit(1);

    if (!conv) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    // 1. Update lead's assigned executive
    await db
      .update(leads)
      .set({
        assignedExecutiveId: newExecutiveId,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, conv.leadId));

    // 2. Update existing handoff if any
    const [existingHandoff] = await db
      .select({ id: handoffs.id })
      .from(handoffs)
      .where(eq(handoffs.leadId, conv.leadId))
      .orderBy(desc(handoffs.createdAt))
      .limit(1);

    if (existingHandoff) {
      await db
        .update(handoffs)
        .set({
          executiveId: newExecutiveId,
        })
        .where(eq(handoffs.id, existingHandoff.id));
    }

    return NextResponse.json({
      success: true,
      newExecutiveName: targetExec.name,
    });
  } catch (error) {
    console.error("POST /api/admin/review/[id]/reassign error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reassign executive" },
      { status: 500 }
    );
  }
}
