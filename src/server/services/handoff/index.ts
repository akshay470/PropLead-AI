import { db } from "@/server/db";
import {
  leads,
  users,
  handoffs,
  conversations,
  projects,
  visitSlots,
  messages,
} from "@/server/db/schema";
import { eq, and, sql, notInArray, desc, gte } from "drizzle-orm";
import { messageService } from "../message-service";

export type HandoffReason =
  | "buyer_requested"
  | "missing_fact"
  | "high_intent"
  | "guardrail"
  | "error";

export interface HandoffSummary {
  language: string;
  project: string;
  bhk: string;
  budget: string;
  visitStatus: string;
  keyQuestions: string[];
  openQuestions: string[];
  sentiment: "positive" | "neutral" | "urgent" | "concerned";
  recommendedNextAction: string;
}

export interface CreateHandoffOptions {
  leadId: string;
  conversationId?: string;
  reason: HandoffReason;
  notes?: string;
  openQuestion?: string;
  dbOrTx?: typeof db;
}

export interface CreateHandoffResult {
  success: boolean;
  handoffId: string;
  executiveId: string;
  executiveName: string;
  executiveEmail: string;
  summary: HandoffSummary;
  isExisting?: boolean;
}

/**
 * Deterministic structured summary generator based on lead state & message history.
 */
function buildDeterministicSummary(
  lead: typeof leads.$inferSelect,
  projectName: string,
  reason: HandoffReason,
  recentMessages: Array<{ role: string; content: string }>,
  notes?: string,
  openQuestion?: string
): HandoffSummary {
  const userMessages = recentMessages.filter((m) => m.role === "user").map((m) => m.content);

  const budgetText =
    lead.budgetMin || lead.budgetMax
      ? `Rs ${(lead.budgetMin || 0) / 100000}L – Rs ${(lead.budgetMax || 0) / 100000}L`
      : "Not specified yet";

  const bhk = lead.wants || "Exploring 2 & 3 BHK options";

  let sentiment: HandoffSummary["sentiment"] = "neutral";
  if (reason === "guardrail") sentiment = "concerned";
  else if (reason === "high_intent") sentiment = "positive";
  else if (reason === "buyer_requested") sentiment = "urgent";

  let nextAction = "Call prospective buyer to provide personalized project walkthrough";
  if (reason === "missing_fact") {
    nextAction = `Confirm information regarding: "${openQuestion || "unanswered fact"}" and follow up`;
  } else if (reason === "guardrail") {
    nextAction = "Clarify official RERA pricing bands and assist with transparent site visit scheduling";
  } else if (lead.status === "visit_scheduled") {
    nextAction = "Review booked slot details and prepare sales gallery welcome kit";
  }

  return {
    language: lead.language || "en",
    project: projectName,
    bhk,
    budget: budgetText,
    visitStatus: lead.status === "visit_scheduled" ? "Site visit booked" : "Visit not booked yet",
    keyQuestions: userMessages.slice(-3),
    openQuestions: openQuestion ? [openQuestion] : notes ? [notes] : [],
    sentiment,
    recommendedNextAction: nextAction,
  };
}

export const handoffService = {
  /**
   * Executes or retrieves an executive handoff for a given lead.
   * Guarantees an executive is assigned, records summary, logs executive notification,
   * and enforces idempotency (prevents duplicate open handoffs within 2 hours).
   */
  async createHandoff(options: CreateHandoffOptions): Promise<CreateHandoffResult> {
    const client = options.dbOrTx || db;

    // 1. Fetch Lead
    const [leadRecord] = await client
      .select()
      .from(leads)
      .where(eq(leads.id, options.leadId))
      .limit(1);

    if (!leadRecord) {
      throw new Error(`Lead ${options.leadId} not found`);
    }

    // 2. Idempotency Check: look for recent handoff in the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const [recentHandoff] = await client
      .select({
        id: handoffs.id,
        executiveId: handoffs.executiveId,
        summary: handoffs.summary,
        execName: users.name,
        execEmail: users.email,
      })
      .from(handoffs)
      .innerJoin(users, eq(handoffs.executiveId, users.id))
      .where(and(eq(handoffs.leadId, options.leadId), gte(handoffs.createdAt, twoHoursAgo)))
      .orderBy(desc(handoffs.createdAt))
      .limit(1);

    if (recentHandoff) {
      let parsedSummary: HandoffSummary;
      try {
        parsedSummary = JSON.parse(recentHandoff.summary);
      } catch {
        parsedSummary = {
          language: leadRecord.language || "en",
          project: "Project",
          bhk: leadRecord.wants || "2/3 BHK",
          budget: "N/A",
          visitStatus: leadRecord.status,
          keyQuestions: [],
          openQuestions: [],
          sentiment: "neutral",
          recommendedNextAction: "Follow up with buyer",
        };
      }

      return {
        success: true,
        handoffId: recentHandoff.id,
        executiveId: recentHandoff.executiveId,
        executiveName: recentHandoff.execName,
        executiveEmail: recentHandoff.execEmail,
        summary: parsedSummary,
        isExisting: true,
      };
    }

    // 3. Select Executive:
    // If assignedExecutiveId exists on lead, use it.
    // Otherwise, select the executive covering this project with the FEWEST open leads.
    let targetExecutive: { id: string; name: string; email: string } | null = null;

    if (leadRecord.assignedExecutiveId) {
      const [assigned] = await client
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, leadRecord.assignedExecutiveId))
        .limit(1);
      if (assigned) targetExecutive = assigned;
    }

    if (!targetExecutive) {
      // Find all executives associated with this project's slots or all executives
      const allExecutives = await client
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.role, "executive"));

      if (allExecutives.length > 0) {
        // Count open leads per executive (leads not in visited or lost)
        const openLeadsCounts = await client
          .select({
            executiveId: leads.assignedExecutiveId,
            count: sql<number>`count(*)::int`,
          })
          .from(leads)
          .where(
            and(
              sql`${leads.assignedExecutiveId} is not null`,
              notInArray(leads.status, ["visited", "lost"])
            )
          )
          .groupBy(leads.assignedExecutiveId);

        const countMap = new Map<string, number>();
        for (const row of openLeadsCounts) {
          if (row.executiveId) countMap.set(row.executiveId, row.count);
        }

        // Sort by fewest open leads
        allExecutives.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0));
        targetExecutive = allExecutives[0];
      }
    }

    // Fallback: any staff user
    if (!targetExecutive) {
      const [anyStaff] = await client
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .limit(1);
      if (!anyStaff) {
        throw new Error("No staff executive available in system to assign handoff");
      }
      targetExecutive = anyStaff;
    }

    // Assign to lead if unassigned
    if (!leadRecord.assignedExecutiveId) {
      await client
        .update(leads)
        .set({
          assignedExecutiveId: targetExecutive.id,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadRecord.id));
    }

    // 4. Fetch project name & recent messages for summary
    let projectName = "Company A Residential Project";
    if (leadRecord.projectId) {
      const [proj] = await client
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, leadRecord.projectId))
        .limit(1);
      if (proj) projectName = proj.name;
    }

    let recentMsgs: Array<{ role: string; content: string }> = [];
    if (options.conversationId) {
      recentMsgs = await client
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, options.conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(10);
      recentMsgs.reverse();
    }

    const structuredSummary = buildDeterministicSummary(
      leadRecord,
      projectName,
      options.reason,
      recentMsgs,
      options.notes,
      options.openQuestion
    );

    // 5. Insert Handoff Record
    const [newHandoff] = await client
      .insert(handoffs)
      .values({
        leadId: leadRecord.id,
        executiveId: targetExecutive.id,
        conversationId: options.conversationId || null,
        reason: options.reason,
        summary: JSON.stringify(structuredSummary),
        createdAt: new Date(),
      })
      .returning();

    // 6. Update lead status if new -> qualified
    if (leadRecord.status === "new") {
      await client
        .update(leads)
        .set({ status: "qualified", updatedAt: new Date() })
        .where(eq(leads.id, leadRecord.id));
    }

    // 7. Send mock executive notification
    const notificationBody = `[PropLead AI Alert] New handoff for lead ${leadRecord.leadCode} (${leadRecord.name}, ${leadRecord.phoneE164}). Reason: ${options.reason}. Assigned to: ${targetExecutive.name}. Action: ${structuredSummary.recommendedNextAction}`;

    await messageService.sendMessage(
      {
        channel: "sms",
        to: targetExecutive.email,
        template: "executive_handoff_notification",
        body: notificationBody,
      },
      client as any
    );

    return {
      success: true,
      handoffId: newHandoff.id,
      executiveId: targetExecutive.id,
      executiveName: targetExecutive.name,
      executiveEmail: targetExecutive.email,
      summary: structuredSummary,
    };
  },
};
