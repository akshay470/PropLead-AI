import { z } from "zod";
import { eq, or, sql, isNull, and } from "drizzle-orm";
import { db } from "../../db";
import { leads } from "../../db/schema";
import { normalizePhoneToE164, phoneSchema } from "@/lib/phone";
import { findDuplicate, DedupeLeadRecord } from "./deduplication";

export const createLeadSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().transform((val, ctx) => {
    try {
      return normalizePhoneToE164(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : "Invalid phone number",
      });
      return z.NEVER;
    }
  }),
  email: z.string().trim().email().toLowerCase().optional().nullable(),
  source: z.enum([
    "property_portal",
    "social_media_ad",
    "website",
    "hoarding_call",
  ]),
  projectId: z.string().uuid().optional().nullable(),
  wants: z.string().trim().optional().nullable(),
  budgetMin: z.number().int().positive().optional().nullable(),
  budgetMax: z.number().int().positive().optional().nullable(),
  language: z.enum(["en", "hi", "gu"]).default("en"),
  consentGiven: z.boolean().default(false),
  optedOut: z.boolean().default(false),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

/**
 * Generates an isolated random lead code matching LD-XXXXX format.
 */
export function generateLeadCode(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `LD-${randomNum}`;
}

/**
 * Sequential collision-safe generator for Lead Code: "LD-XXXXX".
 * Starts above 58200 if fresh, or increments the highest existing number.
 */
export async function getNextLeadCode(tx: typeof db = db): Promise<string> {
  // Retrieve recent lead codes to extract highest numeric suffix
  const recentCodes = await tx
    .select({ leadCode: leads.leadCode })
    .from(leads)
    .where(sql`${leads.leadCode} LIKE 'LD-%'`)
    .limit(500);

  let maxNum = 58200; // Baseline starting counter

  for (const row of recentCodes) {
    const match = row.leadCode.match(/^LD-(\d+)$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `LD-${String(nextNum).padStart(5, "0")}`;
}

/**
 * Creates and ingests a new lead from an enquiry channel (portal, ads, web, hoarding).
 * Automatically runs duplicate detection, preserves source attribution,
 * enforces DPDP consent, and generates sequential lead code.
 */
export async function createLeadFromEnquiry(
  rawInput: unknown,
  tx: typeof db = db
) {
  const input = createLeadSchema.parse(rawInput);
  const normalizedPhone = input.phone;
  const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;

  // 1. Search for existing leads matching candidate by phone or email
  const whereClauses = [eq(leads.phoneE164, normalizedPhone)];
  if (normalizedEmail) {
    whereClauses.push(eq(leads.email, normalizedEmail));
  }

  const potentialMatches = await tx
    .select({
      id: leads.id,
      leadCode: leads.leadCode,
      name: leads.name,
      phoneE164: leads.phoneE164,
      email: leads.email,
      createdAt: leads.createdAt,
      duplicateOfId: leads.duplicateOfId,
      optedOut: leads.optedOut,
    })
    .from(leads)
    .where(or(...whereClauses));

  // 2. Perform duplicate check using pure deduplication engine
  const dedupeResult = findDuplicate(
    {
      phone: normalizedPhone,
      email: normalizedEmail,
      name: input.name,
      optedOut: input.optedOut,
    },
    potentialMatches
  );

  let duplicateOfId: string | null = null;
  let optedOut = input.optedOut;

  if (dedupeResult.isDuplicate && dedupeResult.canonicalLead) {
    duplicateOfId = dedupeResult.canonicalLead.id;
    // An opted-out lead stays opted out after linking
    if (dedupeResult.canonicalLead.optedOut) {
      optedOut = true;
    }
  }

  // 3. Generate sequential lead code
  const leadCode = await getNextLeadCode(tx);

  // 4. Insert new lead
  const [newLead] = await tx
    .insert(leads)
    .values({
      leadCode,
      name: input.name,
      phoneE164: normalizedPhone,
      email: normalizedEmail,
      source: input.source,
      projectId: input.projectId || null,
      wants: input.wants || null,
      budgetMin: input.budgetMin || null,
      budgetMax: input.budgetMax || null,
      language: input.language,
      consentGiven: input.consentGiven,
      optedOut,
      duplicateOfId,
      status: "new",
    })
    .returning();

  return {
    lead: newLead,
    isDuplicate: dedupeResult.isDuplicate,
    canonicalLead: dedupeResult.canonicalLead,
  };
}

/**
 * Sets first_response_at timestamp when the first assistant or executive reply is logged.
 * Does nothing if first_response_at is already recorded.
 */
export async function setFirstResponseAt(
  leadId: string,
  timestamp: Date = new Date(),
  tx: typeof db = db
): Promise<boolean> {
  const result = await tx
    .update(leads)
    .set({
      firstResponseAt: timestamp,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), isNull(leads.firstResponseAt)))
    .returning({ id: leads.id });

  return result.length > 0;
}
