import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { leads, conversations, messages, handoffs } from "../../db/schema";

export interface AnonymizeResult {
  success: boolean;
  leadId?: string;
  error?: string;
}

/**
 * DPDP Act 2023 Compliance - Anonymize a lead and their private data upon request.
 * Preserves the row and visit metrics so reporting aggregates remain accurate,
 * but scrubs all personally identifiable information (PII) and conversation content.
 */
export async function anonymizeLead(leadId: string): Promise<AnonymizeResult> {
  const [existing] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.id, leadId));

  if (!existing) {
    return { success: false, error: "Lead not found" };
  }

  await db.transaction(async (tx) => {
    // 1. Scrub lead PII and mark opted out
    await tx
      .update(leads)
      .set({
        name: "Anonymized Buyer (DPDP)",
        phoneE164: "+910000000000",
        email: null,
        wants: null,
        optedOut: true,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    // 2. Find all conversations for this lead
    const leadConvs = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.leadId, leadId));

    const convIds = leadConvs.map((c) => c.id);

    // 3. Scrub message text & payloads in conversation transcripts
    if (convIds.length > 0) {
      await tx
        .update(messages)
        .set({
          content: "[Message content deleted per DPDP request]",
          payload: null,
        })
        .where(inArray(messages.conversationId, convIds));
    }

    // 4. Scrub executive handoff notes & summaries
    await tx
      .update(handoffs)
      .set({
        summary: "[Handoff summary deleted per DPDP request]",
        notes: null,
      })
      .where(eq(handoffs.leadId, leadId));
  });

  return { success: true, leadId };
}
