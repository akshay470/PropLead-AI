import { eq, and, or, ilike, desc, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { leads, projects, users, leadScores } from "../../db/schema";
import {
  createLeadFromEnquiry,
  setFirstResponseAt,
  createLeadSchema,
  generateLeadCode,
} from "./ingestion";
import { findDuplicate } from "./deduplication";
import { anonymizeLead } from "./anonymize";

export * from "./deduplication";
export * from "./ingestion";
export * from "./anonymize";

export interface GetLeadsFilters {
  search?: string;
  source?: "property_portal" | "social_media_ad" | "website" | "hoarding_call";
  projectId?: string;
  status?: "new" | "contacted" | "qualified" | "visit_scheduled" | "visited" | "lost";
  assignedExecutiveId?: string;
  duplicates?: "only" | "exclude" | "all";
  tier?: "hot" | "warm" | "cold";
  sortBy?: "created_desc" | "score_desc" | "score_asc";
  limit?: number;
  offset?: number;
}

export const leadService = {
  createLeadFromEnquiry,
  setFirstResponseAt,
  findDuplicate,
  generateLeadCode,

  /**
   * Fetches filtered leads joined with project details, assigned executive, and canonical parent.
   */
  async getLeads(filters: GetLeadsFilters = {}) {
    const {
      search,
      source,
      projectId,
      status,
      assignedExecutiveId,
      duplicates = "all",
      tier,
      sortBy = "created_desc",
      limit = 50,
      offset = 0,
    } = filters;

    const conditions = [];

    // Search query across name, phone, lead_code
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(leads.name, term),
          ilike(leads.leadCode, term),
          ilike(leads.phoneE164, term)
        )
      );
    }

    if (source) {
      conditions.push(eq(leads.source, source));
    }

    if (projectId) {
      conditions.push(eq(leads.projectId, projectId));
    }

    if (status) {
      conditions.push(eq(leads.status, status));
    }

    if (assignedExecutiveId) {
      conditions.push(eq(leads.assignedExecutiveId, assignedExecutiveId));
    }

    if (duplicates === "only") {
      conditions.push(isNotNull(leads.duplicateOfId));
    } else if (duplicates === "exclude") {
      conditions.push(isNull(leads.duplicateOfId));
    }

    if (tier) {
      conditions.push(eq(leadScores.tier, tier));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Self-join to fetch canonical lead info
    const canonicalLeads = db
      .select({
        id: leads.id,
        leadCode: leads.leadCode,
        name: leads.name,
      })
      .from(leads)
      .as("canonical_lead");

    const orderExpressions =
      sortBy === "score_desc"
        ? [sql`COALESCE(${leadScores.total}, -1) DESC`, desc(leads.createdAt)]
        : sortBy === "score_asc"
        ? [sql`COALESCE(${leadScores.total}, 999) ASC`, desc(leads.createdAt)]
        : [desc(leads.createdAt)];

    const query = db
      .select({
        id: leads.id,
        leadCode: leads.leadCode,
        name: leads.name,
        phoneE164: leads.phoneE164,
        email: leads.email,
        source: leads.source,
        projectId: leads.projectId,
        projectName: projects.name,
        wants: leads.wants,
        budgetMin: leads.budgetMin,
        budgetMax: leads.budgetMax,
        buyingTimeline: leads.buyingTimeline,
        language: leads.language,
        consentGiven: leads.consentGiven,
        optedOut: leads.optedOut,
        status: leads.status,
        assignedExecutiveId: leads.assignedExecutiveId,
        assignedExecutiveName: users.name,
        duplicateOfId: leads.duplicateOfId,
        canonicalLeadCode: canonicalLeads.leadCode,
        canonicalLeadName: canonicalLeads.name,
        firstResponseAt: leads.firstResponseAt,
        scoreTotal: leadScores.total,
        scoreTier: leadScores.tier,
        scoreBreakdown: leadScores.breakdown,
        scoreDataCompleteness: leadScores.dataCompleteness,
        scoreComputedAt: leadScores.computedAt,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(projects, eq(leads.projectId, projects.id))
      .leftJoin(users, eq(leads.assignedExecutiveId, users.id))
      .leftJoin(canonicalLeads, eq(leads.duplicateOfId, canonicalLeads.id))
      .leftJoin(leadScores, eq(leads.id, leadScores.leadId))
      .where(whereClause)
      .orderBy(...orderExpressions)
      .limit(limit)
      .offset(offset);

    const rows = await query;

    // Also get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .leftJoin(leadScores, eq(leads.id, leadScores.leadId))
      .where(whereClause);

    return {
      leads: rows,
      totalCount: countResult?.count ?? 0,
      limit,
      offset,
    };
  },

  /**
   * Assigns an executive to a lead.
   */
  async assignExecutive(leadId: string, executiveId: string | null) {
    const [updated] = await db
      .update(leads)
      .set({
        assignedExecutiveId: executiveId,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return updated;
  },

  /**
   * Confirms a lead as a duplicate of a canonical lead.
   */
  async confirmDuplicate(leadId: string, canonicalLeadId: string) {
    if (leadId === canonicalLeadId) {
      throw new Error("A lead cannot be marked as a duplicate of itself");
    }

    const [updated] = await db
      .update(leads)
      .set({
        duplicateOfId: canonicalLeadId,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return updated;
  },

  /**
   * Unlinks a lead from being marked as a duplicate.
   */
  async unlinkDuplicate(leadId: string) {
    const [updated] = await db
      .update(leads)
      .set({
        duplicateOfId: null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return updated;
  },
};
