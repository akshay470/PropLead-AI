import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { factSheetEntries } from "@/server/db/schema";
import { checkPriceGuardrails } from "@/server/ai/guardrails/price-checker";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateFactSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  questionKey: z.string().min(1).max(255).optional(),
  answerText: z.string().min(5, "Answer text must be at least 5 characters").optional(),
});

/**
 * PUT /api/admin/facts/[id]
 * Updates an existing fact sheet entry with guardrail validation.
 */
export async function PUT(
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

    const json = await request.json();
    const parsed = updateFactSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { category, questionKey, answerText } = parsed.data;

    // Check guardrail if answerText is changing
    if (answerText) {
      const guardrail = checkPriceGuardrails(answerText, "en");
      if (!guardrail.passed) {
        return NextResponse.json(
          {
            success: false,
            error: "Fact Sheet Compliance Violation: Entry rejected by RERA price guardrail.",
            reason: guardrail.reason,
            violatingSnippet: guardrail.violatingSnippet,
          },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(factSheetEntries)
      .set({
        category: category?.trim(),
        questionKey: questionKey?.toLowerCase().trim().replace(/\s+/g, "_"),
        answerText: answerText?.trim(),
        updatedAt: new Date(),
      })
      .where(eq(factSheetEntries.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, error: "Fact entry not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      fact: updated,
    });
  } catch (error) {
    console.error("PUT /api/admin/facts/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to update fact" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/facts/[id]
 * Deletes a fact sheet entry.
 */
export async function DELETE(
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

    const [deleted] = await db
      .delete(factSheetEntries)
      .where(eq(factSheetEntries.id, params.id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Fact entry not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Fact sheet entry deleted",
    });
  } catch (error) {
    console.error("DELETE /api/admin/facts/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete fact" }, { status: 500 });
  }
}
