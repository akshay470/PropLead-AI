import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { factSheetEntries, projects } from "@/server/db/schema";
import { checkPriceGuardrails } from "@/server/ai/guardrails/price-checker";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const createFactSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  category: z.string().min(1, "Category is required").max(100),
  questionKey: z.string().min(1, "Question key is required").max(255),
  answerText: z.string().min(5, "Answer text must be at least 5 characters"),
});

/**
 * GET /api/admin/facts
 * Lists fact sheet entries, optionally filtered by projectId.
 * Role protected: Admin (Sales Head) only.
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const query = db
      .select({
        id: factSheetEntries.id,
        projectId: factSheetEntries.projectId,
        projectName: projects.name,
        category: factSheetEntries.category,
        questionKey: factSheetEntries.questionKey,
        answerText: factSheetEntries.answerText,
        updatedAt: factSheetEntries.updatedAt,
      })
      .from(factSheetEntries)
      .innerJoin(projects, eq(factSheetEntries.projectId, projects.id));

    const rows = projectId
      ? await query.where(eq(factSheetEntries.projectId, projectId)).orderBy(desc(factSheetEntries.updatedAt))
      : await query.orderBy(desc(factSheetEntries.updatedAt));

    return NextResponse.json({
      success: true,
      facts: rows,
    });
  } catch (error) {
    console.error("GET /api/admin/facts error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/facts
 * Creates a new fact sheet entry.
 * Validates against pricing guardrails: rejects exact prices, discounts, or unauthorized claims.
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
    const parsed = createFactSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, category, questionKey, answerText } = parsed.data;

    // Run statutory pricing guardrail check scoped to the project!
    const guardrail = checkPriceGuardrails(answerText, "en", projectId);
    if (!guardrail.passed) {
      return NextResponse.json(
        {
          success: false,
          error: "Fact Sheet Compliance Violation: Entry rejected by RERA price guardrail.",
          reason: guardrail.reason,
          violatingSnippet: guardrail.violatingSnippet,
          guidance:
            "Fact sheet entries must only cite approved price ranges per BHK (Rs 65L - Rs 1.20Cr). Exact unit prices, cash discounts, negotiation language, or unapproved schemes are strictly forbidden.",
        },
        { status: 400 }
      );
    }

    const [inserted] = await db
      .insert(factSheetEntries)
      .values({
        projectId,
        category,
        questionKey: questionKey.toLowerCase().trim().replace(/\s+/g, "_"),
        answerText: answerText.trim(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      fact: inserted,
    });
  } catch (error) {
    console.error("POST /api/admin/facts error:", error);
    return NextResponse.json({ success: false, error: "Failed to create fact" }, { status: 500 });
  }
}
