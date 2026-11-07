/**
 * Lead Priority Score Engine
 *
 * Provides pure, deterministic, and explainable scoring for real estate buyer intent.
 * Evaluates intent signals ONLY (budget, timeline, site visit status, unit preferences, engagement).
 * Never considers personal attributes (name, phone, email, language).
 *
 * Score bounds: 0 to 100.
 * Maximums:
 * - budget: 25
 * - timeline: 25
 * - siteVisit: 20
 * - preference: 15
 * - engagement: 15
 *
 * Tiers:
 * - hot:  >= 70
 * - warm: 40 to 69
 * - cold: < 40
 */

import { eq, desc, and } from "drizzle-orm";
import { db } from "../../db";
import {
  leads,
  leadScores,
  projects,
  bookings,
  conversations,
  messages,
  factSheetEntries,
} from "../../db/schema";
import { handoffService } from "../handoff";

export type BuyingTimeline =
  | "within_1_month"
  | "1_to_3_months"
  | "3_to_6_months"
  | "exploring"
  | "unknown";

export type LeadTier = "hot" | "warm" | "cold";
export type DataCompleteness = "complete" | "partial" | "insufficient";

export interface ScoreParameterBreakdown {
  points: number;
  maxPoints: number;
  reason: string;
}

export interface LeadScoreBreakdown {
  budget: ScoreParameterBreakdown;
  timeline: ScoreParameterBreakdown;
  siteVisit: ScoreParameterBreakdown;
  preference: ScoreParameterBreakdown;
  engagement: ScoreParameterBreakdown;
  missing: string[];
}

export interface LeadScoreResult {
  total: number;
  tier: LeadTier;
  breakdown: LeadScoreBreakdown;
  dataCompleteness: DataCompleteness;
  scoreVersion: string;
}

export interface LeadScoreInput {
  // Budget signals
  budgetMin?: number | null;
  budgetMax?: number | null;
  projectMinPrice?: number | null;
  projectMaxPrice?: number | null;

  // Timeline signals
  buyingTimeline?: BuyingTimeline | null;

  // Site visit signals
  hasVisited?: boolean;
  hasConfirmedBooking?: boolean;
  hasRescheduledBooking?: boolean;
  hasCancelledBooking?: boolean;
  hasNoShow?: boolean;

  // Unit configuration preference signals
  wants?: string | null;

  // Engagement signals
  messageCount?: number;
  conversationCount?: number;
}

/**
 * Pure function computing the Lead Priority Score and explainable breakdown.
 * Deterministic and free of side effects.
 */
export function computeLeadScore(input: LeadScoreInput): LeadScoreResult {
  const missing: string[] = [];

  // ==========================================
  // 1. BUDGET PARAMETER (Max 25 points)
  // ==========================================
  let budgetPoints = 0;
  let budgetReason = "";

  const minB = input.budgetMin ?? null;
  const maxB = input.budgetMax ?? null;
  const effectiveBudget = maxB || minB || null;

  if (effectiveBudget === null || effectiveBudget <= 0) {
    // Missing input scores small neutral value
    budgetPoints = 8;
    budgetReason = "Budget not yet stated (insufficient data)";
    missing.push("budget");
  } else {
    const projMin = input.projectMinPrice ?? 6500000; // Default to portfolio base Rs 65L if not provided
    const projMax = input.projectMaxPrice ?? 12000000;

    if (effectiveBudget >= projMin && effectiveBudget <= projMax * 1.3) {
      budgetPoints = 25;
      budgetReason = `Budget (Rs ${(effectiveBudget / 100000).toFixed(0)} Lakh) aligns with project pricing range`;
    } else if (effectiveBudget > projMax * 1.3) {
      budgetPoints = 25;
      budgetReason = `Budget (Rs ${(effectiveBudget / 100000).toFixed(0)} Lakh) comfortably covers luxury configurations`;
    } else if (effectiveBudget >= projMin * 0.85) {
      budgetPoints = 16;
      budgetReason = `Budget (Rs ${(effectiveBudget / 100000).toFixed(0)} Lakh) slightly below project entry point`;
    } else if (effectiveBudget >= projMin * 0.7) {
      budgetPoints = 8;
      budgetReason = `Budget (Rs ${(effectiveBudget / 100000).toFixed(0)} Lakh) moderately below project entry point`;
    } else {
      budgetPoints = 4;
      budgetReason = `Budget (Rs ${(effectiveBudget / 100000).toFixed(0)} Lakh) substantially below project pricing range`;
    }
  }

  // ==========================================
  // 2. TIMELINE PARAMETER (Max 25 points)
  // ==========================================
  let timelinePoints = 0;
  let timelineReason = "";

  const timeline = input.buyingTimeline ?? "unknown";

  switch (timeline) {
    case "within_1_month":
      timelinePoints = 25;
      timelineReason = "Immediate buyer window (ready within 1 month)";
      break;
    case "1_to_3_months":
      timelinePoints = 20;
      timelineReason = "Near-term purchasing window (1 to 3 months)";
      break;
    case "3_to_6_months":
      timelinePoints = 12;
      timelineReason = "Medium-term planning horizon (3 to 6 months)";
      break;
    case "exploring":
      timelinePoints = 6;
      timelineReason = "Initial exploratory research phase";
      break;
    case "unknown":
    default:
      timelinePoints = 8;
      timelineReason = "Purchase timeline not yet specified (insufficient data)";
      missing.push("timeline");
      break;
  }

  // ==========================================
  // 3. SITE VISIT PARAMETER (Max 20 points)
  // ==========================================
  let visitPoints = 0;
  let visitReason = "";

  if (input.hasVisited) {
    visitPoints = 20;
    visitReason = "Completed in-person experiential flat visit";
  } else if (input.hasConfirmedBooking) {
    visitPoints = 16;
    visitReason = "Confirmed upcoming site appointment scheduled";
  } else if (input.hasRescheduledBooking) {
    visitPoints = 12;
    visitReason = "Visit appointment actively rescheduled";
  } else if (input.hasCancelledBooking || input.hasNoShow) {
    visitPoints = 4;
    visitReason = "Site visit previously cancelled or missed";
  } else {
    visitPoints = 4;
    visitReason = "Site visit appointment not yet scheduled (insufficient data)";
    missing.push("siteVisit");
  }

  // ==========================================
  // 4. PREFERENCE PARAMETER (Max 15 points)
  // ==========================================
  let prefPoints = 0;
  let prefReason = "";

  const wants = (input.wants || "").trim().toLowerCase();

  if (!wants) {
    prefPoints = 4;
    prefReason = "Unit layout preference not specified (insufficient data)";
    missing.push("preference");
  } else if (
    wants.includes("2bhk") ||
    wants.includes("3bhk") ||
    wants.includes("2 bhk") ||
    wants.includes("3 bhk") ||
    wants.includes("4bhk") ||
    wants.includes("penthouse")
  ) {
    prefPoints = 15;
    prefReason = `Specific residential configuration stated (${input.wants})`;
  } else if (wants.includes("flat") || wants.includes("apartment") || wants.includes("home")) {
    prefPoints = 8;
    prefReason = `General residential inquiry (${input.wants})`;
  } else {
    prefPoints = 6;
    prefReason = `Preliminary preference specified (${input.wants})`;
  }

  // ==========================================
  // 5. ENGAGEMENT PARAMETER (Max 15 points)
  // ==========================================
  let engPoints = 0;
  let engReason = "";

  const msgCount = input.messageCount ?? 0;

  if (msgCount >= 6) {
    engPoints = 15;
    engReason = `High conversation interaction (${msgCount} messages exchanged)`;
  } else if (msgCount >= 3) {
    engPoints = 10;
    engReason = `Active conversation interaction (${msgCount} messages exchanged)`;
  } else if (msgCount >= 1) {
    engPoints = 6;
    engReason = `Initial interaction initiated (${msgCount} message${msgCount > 1 ? "s" : ""})`;
  } else {
    engPoints = 3;
    engReason = "No conversational messages recorded yet (insufficient data)";
    missing.push("engagement");
  }

  // ==========================================
  // TOTAL & TIER ASSIGNMENT
  // ==========================================
  const rawTotal =
    budgetPoints + timelinePoints + visitPoints + prefPoints + engPoints;
  const total = Math.max(0, Math.min(100, Math.round(rawTotal)));

  let tier: LeadTier = "cold";
  if (total >= 70) {
    tier = "hot";
  } else if (total >= 40) {
    tier = "warm";
  } else {
    tier = "cold";
  }

  let dataCompleteness: DataCompleteness = "complete";
  if (missing.length >= 3) {
    dataCompleteness = "insufficient";
  } else if (missing.length >= 1) {
    dataCompleteness = "partial";
  }

  return {
    total,
    tier,
    breakdown: {
      budget: { points: budgetPoints, maxPoints: 25, reason: budgetReason },
      timeline: { points: timelinePoints, maxPoints: 25, reason: timelineReason },
      siteVisit: { points: visitPoints, maxPoints: 20, reason: visitReason },
      preference: { points: prefPoints, maxPoints: 15, reason: prefReason },
      engagement: { points: engPoints, maxPoints: 15, reason: engReason },
      missing,
    },
    dataCompleteness,
    scoreVersion: "v1",
  };
}

/**
 * Resolves project minimum and maximum price endpoints from registered fact sheets.
 */
export async function getProjectPriceRange(
  projectId: string | null | undefined,
  client = db
): Promise<{ minPrice: number; maxPrice: number }> {
  if (!projectId) {
    return { minPrice: 6500000, maxPrice: 12000000 };
  }

  const entries = await client
    .select({ answerText: factSheetEntries.answerText })
    .from(factSheetEntries)
    .where(
      and(
        eq(factSheetEntries.projectId, projectId),
        eq(factSheetEntries.category, "Pricing")
      )
    );

  let foundMin: number | null = null;
  let foundMax: number | null = null;

  for (const entry of entries) {
    const text = entry.answerText;
    // Look for lakh and crore mentions
    const lakhMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)/gi)];
    for (const m of lakhMatches) {
      const val = Math.round(parseFloat(m[1]) * 100000);
      if (foundMin === null || val < foundMin) foundMin = val;
      if (foundMax === null || val > foundMax) foundMax = val;
    }
    const croreMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:crore|cr)/gi)];
    for (const m of croreMatches) {
      const val = Math.round(parseFloat(m[1]) * 10000000);
      if (foundMin === null || val < foundMin) foundMin = val;
      if (foundMax === null || val > foundMax) foundMax = val;
    }
  }

  return {
    minPrice: foundMin || 6500000,
    maxPrice: foundMax || 12000000,
  };
}

/**
 * Idempotently recomputes the Lead Priority Score for a lead, records it in the database,
 * and triggers an executive handoff with reason 'high_intent' when crossing into 'hot'.
 */
export async function recomputeLeadScore(
  leadId: string,
  clientOrTx: any = db
): Promise<LeadScoreResult> {
  const client = clientOrTx || db;

  // 1. Fetch Lead
  const [leadRecord] = await client
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!leadRecord) {
    throw new Error(`Cannot score non-existent lead: ${leadId}`);
  }

  // 2. Resolve Project Price Range from registered fact sheet
  const { minPrice, maxPrice } = await getProjectPriceRange(
    leadRecord.projectId,
    client
  );

  // 3. Resolve Bookings history
  const leadBookings = await client
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.leadId, leadId));

  const hasVisited = leadBookings.some((b: { status: string }) => b.status === "visited");
  const hasConfirmedBooking = leadBookings.some(
    (b: { status: string }) => b.status === "confirmed"
  );
  const hasRescheduledBooking = leadBookings.some(
    (b: { status: string }) => b.status === "rescheduled"
  );
  const hasCancelledBooking = leadBookings.some(
    (b: { status: string }) => b.status === "cancelled"
  );
  const hasNoShow = leadBookings.some((b: { status: string }) => b.status === "no_show");

  // 4. Resolve Engagement (message count across conversations)
  const convs = await client
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.leadId, leadId));

  let messageCount = 0;
  for (const c of convs) {
    const msgs = await client
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, c.id));
    messageCount += msgs.length;
  }

  // 5. Compute pure score
  const scoreResult = computeLeadScore({
    budgetMin: leadRecord.budgetMin,
    budgetMax: leadRecord.budgetMax,
    projectMinPrice: minPrice,
    projectMaxPrice: maxPrice,
    buyingTimeline: leadRecord.buyingTimeline as BuyingTimeline,
    hasVisited,
    hasConfirmedBooking,
    hasRescheduledBooking,
    hasCancelledBooking,
    hasNoShow,
    wants: leadRecord.wants,
    messageCount,
    conversationCount: convs.length,
  });

  // 6. Check previous score to detect if crossing into hot for the first time
  const [previousScore] = await client
    .select({ tier: leadScores.tier })
    .from(leadScores)
    .where(eq(leadScores.leadId, leadId))
    .limit(1);

  const wasHot = previousScore?.tier === "hot";
  const isNowHot = scoreResult.tier === "hot";

  // 7. Upsert lead_scores record
  await client
    .insert(leadScores)
    .values({
      leadId,
      total: scoreResult.total,
      tier: scoreResult.tier,
      breakdown: scoreResult.breakdown,
      dataCompleteness: scoreResult.dataCompleteness,
      scoreVersion: scoreResult.scoreVersion,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: leadScores.leadId,
      set: {
        total: scoreResult.total,
        tier: scoreResult.tier,
        breakdown: scoreResult.breakdown,
        dataCompleteness: scoreResult.dataCompleteness,
        scoreVersion: scoreResult.scoreVersion,
        computedAt: new Date(),
      },
    });

  // 8. High-Intent Handoff Trigger:
  // When a lead first crosses into 'hot', create a handoff with reason 'high_intent'
  if (!wasHot && isNowHot) {
    try {
      await handoffService.createHandoff({
        leadId,
        reason: "high_intent",
        notes: `Lead Priority Score crossed into Hot tier (${scoreResult.total}/100)`,
        dbOrTx: client,
      });
    } catch (err) {
      console.warn("High-intent handoff creation note:", err);
    }
  }

  return scoreResult;
}
