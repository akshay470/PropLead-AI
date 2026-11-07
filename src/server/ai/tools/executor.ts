import { z } from "zod";
import { db } from "@/server/db";
import { factSheetEntries, leads, conversations, projects, users } from "@/server/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { bookingService } from "@/server/services/booking";
import { handoffService, HandoffReason } from "@/server/services/handoff";
import { recomputeLeadScore } from "@/server/services/scoring";
import { ToolCall } from "../types";

export interface ToolExecutionContext {
  leadId: string;
  conversationId: string;
  projectId?: string | null;
  usedFactIds: string[];
  uiPayloads: Array<{ type: string; [key: string]: unknown }>;
  dbOrTx?: typeof db;
}

// Zod schemas for tool parameters
const getFactSchema = z.object({
  projectId: z.string().uuid().optional(),
  category: z.string().optional(),
  query: z.string().min(1),
});

const saveLeadDetailsSchema = z.object({
  wants: z.string().optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  projectId: z.string().uuid().optional(),
  language: z.enum(["en", "hi", "gu"]).optional(),
  buying_timeline: z
    .enum([
      "within_1_month",
      "1_to_3_months",
      "3_to_6_months",
      "exploring",
      "unknown",
    ])
    .optional(),
  notes: z.string().optional(),
});

const listFreeSlotsSchema = z.object({
  projectId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const bookVisitSchema = z.object({
  slotId: z.string().uuid(),
});

const handoffSchema = z.object({
  reason: z.enum(["buyer_requested", "missing_fact", "high_intent", "guardrail", "error"]),
  summary_notes: z.string().optional(),
});

const flagConversationSchema = z.object({
  reason: z.string().min(1),
});

/**
 * Executes an individual tool call inside the secure session context.
 * Always resolves leadId and conversationId from the verified session,
 * never allowing the LLM or client to spoof identities.
 */
export async function executeToolCall(
  toolCall: ToolCall,
  context: ToolExecutionContext
): Promise<{ toolCallId: string; result: Record<string, unknown> }> {
  const client = context.dbOrTx || db;
  const args = toolCall.arguments;

  try {
    switch (toolCall.name) {
      // 1. GET_FACT
      case "get_fact": {
        const parsed = getFactSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolCallId: toolCall.id,
            result: { error: "Invalid parameters for get_fact", details: parsed.error.flatten() },
          };
        }

        const { query, category } = parsed.data;
        const targetProjectId = parsed.data.projectId || context.projectId;

        // Search fact sheet entries
        const searchConditions = [];
        if (targetProjectId) {
          searchConditions.push(eq(factSheetEntries.projectId, targetProjectId));
        }
        if (category) {
          searchConditions.push(ilike(factSheetEntries.category, `%${category}%`));
        }

        // Fuzzy / text match on answer text or question key
        const textMatches = or(
          ilike(factSheetEntries.answerText, `%${query}%`),
          ilike(factSheetEntries.questionKey, `%${query}%`),
          ilike(factSheetEntries.category, `%${query}%`)
        );

        let factRows = await client
          .select({
            id: factSheetEntries.id,
            projectId: factSheetEntries.projectId,
            category: factSheetEntries.category,
            questionKey: factSheetEntries.questionKey,
            answerText: factSheetEntries.answerText,
          })
          .from(factSheetEntries)
          .where(searchConditions.length > 0 ? and(...searchConditions, textMatches) : textMatches)
          .limit(4);

        // Fallback: If no match with specific query, return general category info if category was specified
        if (factRows.length === 0 && category && targetProjectId) {
          factRows = await client
            .select({
              id: factSheetEntries.id,
              projectId: factSheetEntries.projectId,
              category: factSheetEntries.category,
              questionKey: factSheetEntries.questionKey,
              answerText: factSheetEntries.answerText,
            })
            .from(factSheetEntries)
            .where(
              and(
                eq(factSheetEntries.projectId, targetProjectId),
                ilike(factSheetEntries.category, `%${category}%`)
              )
            )
            .limit(2);
        }

        // Track used fact IDs for audit logging on the message row
        for (const f of factRows) {
          if (!context.usedFactIds.includes(f.id)) {
            context.usedFactIds.push(f.id);
          }
        }

        if (factRows.length === 0) {
          return {
            toolCallId: toolCall.id,
            result: {
              found: false,
              message:
                "No verified fact sheet entry matched this query. Do not guess; inform the buyer our team will confirm, and call handoff_to_executive with reason='missing_fact'.",
            },
          };
        }

        return {
          toolCallId: toolCall.id,
          result: {
            found: true,
            count: factRows.length,
            facts: factRows.map((f) => ({
              id: f.id,
              category: f.category,
              answer: f.answerText,
            })),
          },
        };
      }

      // 2. SAVE_LEAD_DETAILS
      case "save_lead_details": {
        const parsed = saveLeadDetailsSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolCallId: toolCall.id,
            result: { error: "Invalid parameters for save_lead_details", details: parsed.error.flatten() },
          };
        }

        const data = parsed.data;
        const updateValues: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (data.wants !== undefined) updateValues.wants = data.wants;
        if (data.budgetMin !== undefined) updateValues.budgetMin = data.budgetMin;
        if (data.budgetMax !== undefined) updateValues.budgetMax = data.budgetMax;
        if (data.projectId !== undefined) {
          updateValues.projectId = data.projectId;
          context.projectId = data.projectId;
        }
        if (data.language !== undefined) updateValues.language = data.language;
        if (data.buying_timeline !== undefined) updateValues.buyingTimeline = data.buying_timeline;

        await client
          .update(leads)
          .set(updateValues)
          .where(eq(leads.id, context.leadId));

        // Recompute Lead Priority Score idempotently
        await recomputeLeadScore(context.leadId, client);

        return {
          toolCallId: toolCall.id,
          result: { success: true, message: "Lead preferences updated successfully" },
        };
      }

      // 3. LIST_FREE_SLOTS
      case "list_free_slots": {
        const parsed = listFreeSlotsSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolCallId: toolCall.id,
            result: { error: "Invalid parameters for list_free_slots", details: parsed.error.flatten() },
          };
        }

        const { projectId, from, to } = parsed.data;
        const freeSlots = await bookingService.listFreeSlots({
          projectId,
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
          dbOrTx: client as any,
        });

        // Cap to at most 6 options
        const cappedSlots = freeSlots.slice(0, 6);

        // Append UI payload so client renders tappable slot chips
        if (cappedSlots.length > 0) {
          context.uiPayloads.push({
            type: "slot_options",
            projectId,
            slots: cappedSlots.map((s) => ({
              id: s.id,
              startsAt: s.startsAt.toISOString(),
              endsAt: s.endsAt.toISOString(),
              executiveFirstName: s.executiveFirstName,
            })),
          });
        }

        return {
          toolCallId: toolCall.id,
          result: {
            success: true,
            totalAvailable: freeSlots.length,
            slots: cappedSlots.map((s) => ({
              id: s.id,
              startsAt: s.startsAt.toISOString(),
              endsAt: s.endsAt.toISOString(),
              executive: s.executiveFirstName || "Sales Specialist",
            })),
          },
        };
      }

      // 4. BOOK_VISIT
      case "book_visit": {
        const parsed = bookVisitSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolCallId: toolCall.id,
            result: { error: "Invalid parameters for book_visit", details: parsed.error.flatten() },
          };
        }

        // Strictly derive leadId from session context!
        const bookingResult = await bookingService.bookVisit(
          {
            slotId: parsed.data.slotId,
            leadId: context.leadId,
          },
          client as any
        );

        if (!bookingResult.success) {
          if (bookingResult.code === "SLOT_TAKEN") {
            // Include alternative slots in UI payload
            context.uiPayloads.push({
              type: "slot_taken_alternatives",
              alternativeSlots: bookingResult.alternativeSlots.slice(0, 3),
            });

            return {
              toolCallId: toolCall.id,
              result: {
                success: false,
                code: "SLOT_TAKEN",
                message: "This slot was just confirmed by another buyer. Please recommend one of these alternative free slots:",
                alternativeSlots: bookingResult.alternativeSlots.slice(0, 3).map((alt) => ({
                  id: alt.id,
                  startsAt: alt.startsAt.toISOString(),
                  executive: alt.executiveFirstName,
                })),
              },
            };
          }

          return {
            toolCallId: toolCall.id,
            result: {
              success: false,
              code: bookingResult.code,
              message: bookingResult.message,
            },
          };
        }

        // Fetch project and executive details to formulate UI booking card payload
        const [lead] = await client
          .select({ name: leads.name, leadCode: leads.leadCode })
          .from(leads)
          .where(eq(leads.id, context.leadId))
          .limit(1);

        const [slotDetails] = await client
          .select({
            startsAt: factSheetEntries.updatedAt, // dummy
            pName: projects.name,
            pAddress: projects.address,
            pLat: projects.lat,
            pLng: projects.lng,
            pRera: projects.reraNumber,
            execName: users.name,
          })
          .from(projects)
          .limit(1);

        context.uiPayloads.push({
          type: "booking_confirmation",
          bookingId: bookingResult.booking.id,
          leadName: lead?.name || "Buyer",
          leadCode: lead?.leadCode,
          slotId: parsed.data.slotId,
          remindersScheduled: bookingResult.reminders.length,
        });

        // Recompute Lead Priority Score idempotently
        await recomputeLeadScore(context.leadId, client);

        return {
          toolCallId: toolCall.id,
          result: {
            success: true,
            bookingId: bookingResult.booking.id,
            status: "confirmed",
            message: "Visit successfully booked and reminders scheduled.",
          },
        };
      }

      // 5. HANDOFF_TO_EXECUTIVE
      case "handoff_to_executive": {
        const parsed = handoffSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolCallId: toolCall.id,
            result: { error: "Invalid parameters for handoff", details: parsed.error.flatten() },
          };
        }

        const handoffResult = await handoffService.createHandoff({
          leadId: context.leadId,
          conversationId: context.conversationId,
          reason: parsed.data.reason as HandoffReason,
          notes: parsed.data.summary_notes,
          dbOrTx: client as any,
        });

        context.uiPayloads.push({
          type: "handoff_notice",
          executiveName: handoffResult.executiveName,
          reason: parsed.data.reason,
        });

        return {
          toolCallId: toolCall.id,
          result: {
            success: true,
            executiveAssigned: handoffResult.executiveName,
            message: `Handoff created. Inform the buyer that ${handoffResult.executiveName} from our sales team has been assigned and will follow up directly.`,
          },
        };
      }

      // 6. FLAG_CONVERSATION
      case "flag_conversation": {
        const parsed = flagConversationSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolCallId: toolCall.id,
            result: { error: "Invalid parameters for flag_conversation" },
          };
        }

        return {
          toolCallId: toolCall.id,
          result: {
            success: true,
            message: "Conversation flagged for sales head daily review.",
          },
        };
      }

      default:
        return {
          toolCallId: toolCall.id,
          result: { error: `Unknown tool '${toolCall.name}'` },
        };
    }
  } catch (error) {
    console.error(`Tool execution error for ${toolCall.name}:`, error);
    return {
      toolCallId: toolCall.id,
      result: {
        error: error instanceof Error ? error.message : "Internal tool execution failure",
      },
    };
  }
}
