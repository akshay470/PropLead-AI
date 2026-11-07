import { db } from "@/server/db";
import { messages, conversations, leads, projects } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { ILlmProvider, ChatMessage } from "./types";
import { getLlmProvider } from "./provider";
import { AGENT_TOOLS } from "./tools/definitions";
import { executeToolCall, ToolExecutionContext } from "./tools/executor";
import { SYSTEM_PROMPT_V1 } from "./prompts/system-v1";
import { checkPriceGuardrails } from "./guardrails/price-checker";
import { handoffService } from "../services/handoff";
import { setFirstResponseAt } from "../services/leads/ingestion";
import { categorizeLlmError } from "./errors";
import { recomputeLeadScore } from "../services/scoring";

export interface RunAgentTurnOptions {
  leadId: string;
  conversationId: string;
  userMessage: string;
  provider?: ILlmProvider;
  dbOrTx?: any;
}

export interface RunAgentTurnResult {
  reply: string;
  language: "en" | "hi" | "gu";
  flagged: boolean;
  flagReason?: string;
  latencyMs: number;
  payloads: Array<{ type: string; [key: string]: unknown }>;
  usedFactIds: string[];
}

/**
 * Detects whether the input message is in Hindi, Gujarati, or English.
 */
export function detectMessageLanguage(text: string): "en" | "hi" | "gu" {
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari script
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu"; // Gujarati script
  return "en";
}

/**
 * Checks for opt-out keywords (DPDP Act compliance) across English, Hindi, and Gujarati.
 * - Triggers on exact keywords: STOP, UNSUBSCRIBE, and Indic equivalents (after trimming/lowercasing)
 * - Triggers on clear unambiguous phrases: "stop messaging me", "stop sending messages", etc.
 * - Words like "cancel", "रद्द", "રદ" inside a longer sentence (e.g. "cancel my visit") do NOT opt out.
 * - Unrelated sentences containing the word "stop" (e.g. "stop by tomorrow", "bus stop") do NOT opt out.
 */
export function isOptOutMessage(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/^["'“”‘’\s.,!?:;]+|["'“”‘’\s.,!?:;]+$/gu, "");

  // 1. Exact opt-out keywords (complete match only)
  const EXACT_KEYWORDS = new Set([
    "stop",
    "unsubscribe",
    "optout",
    "opt-out",
    "halt",
    // Hindi exact equivalents (stopping messages/contact)
    "बंद करो",
    "रोकें",
    "रोको",
    "अनसब्सक्राइब",
    // Gujarati exact equivalents
    "બંધ કરો",
    "રોકો",
    "અનસબ્સ્ક્રાઇબ",
  ]);

  if (EXACT_KEYWORDS.has(normalized)) {
    return true;
  }

  // 2. Clear unambiguous phrases
  const EXACT_PHRASES = [
    /^stop\s+(messaging|contacting|calling|sms|messages?|sending\s+messages?)(?:\s+me)?$/i,
    /^(please\s+)?stop\s+(messaging|contacting|sending\s+messages?)(?:\s+me)?$/i,
    /^(do\s+not|don't|dont)\s+(message|contact|call|send\s+messages?)(?:\s+me)?$/i,
    /^unsubscribe\s+me$/i,
    // Hindi clear phrases
    /^(मुझे\s+)?(कोई\s+)?(मैसेज|संदेश|कॉल)\s+(भेजना\s+)?(बंद\s+करो|मत\s+भेजो|मत\s+कीजिए)/i,
    /^(मुझे\s+)?(मैसेज|संदेश)\s+मत\s+(भेजो|कीजिए)/i,
    // Gujarati clear phrases
    /^(મને\s+)?(કોઈ\s+)?(મેસેજ|સંદેશા)\s+(મોકલવાનું\s+)?(બંધ\s+કરો|ના\s+મોકલો)/i,
    /^(મને\s+)?(મેસેજ|સંદેશા)\s+ના\s+મોકલો/i,
  ];

  return EXACT_PHRASES.some((regex) => regex.test(normalized));
}

/**
 * Checks if a message ambiguously mentions stopping communications without being an exact opt-out.
 */
export function isAmbiguousOptOutQuery(text: string): boolean {
  if (isOptOutMessage(text)) return false;
  const lower = text.trim().toLowerCase();
  return (
    (lower.includes("stop") &&
      (lower.includes("message") ||
        lower.includes("notification") ||
        lower.includes("text") ||
        lower.includes("contact"))) ||
    lower.includes("how to unsubscribe") ||
    lower.includes("how do i opt out") ||
    lower.includes("मैसेज बंद करना") ||
    lower.includes("સંદેશા બંધ કરવા")
  );
}

/**
 * Orchestrates a complete autonomous conversation turn:
 * - Language detection & opt-out handling
 * - Multi-turn tool calling loop (max 5 iterations)
 * - Safe LLM fallback on timeout/crash
 * - Post-generation price and compliance guardrail enforcement
 * - First response metric recording & audit logging
 */
export async function runAgentTurn(options: RunAgentTurnOptions): Promise<RunAgentTurnResult> {
  const startTime = Date.now();
  const client = options.dbOrTx || db;
  const provider = options.provider || getLlmProvider();

  const detectedLanguage = detectMessageLanguage(options.userMessage);

  // 1. Fetch Lead record to know existing project context
  const [leadRecord] = await client
    .select({
      id: leads.id,
      projectId: leads.projectId,
      projectName: projects.name,
      projectLocation: projects.locationName,
      optedOut: leads.optedOut,
      firstResponseAt: leads.firstResponseAt,
    })
    .from(leads)
    .leftJoin(projects, eq(leads.projectId, projects.id))
    .where(eq(leads.id, options.leadId))
    .limit(1);

  const context: ToolExecutionContext = {
    leadId: options.leadId,
    conversationId: options.conversationId,
    projectId: leadRecord?.projectId || null,
    usedFactIds: [],
    uiPayloads: [],
    dbOrTx: client,
  };

  // 2. Handle Opt-out immediately (DPDP compliance)
  if (isOptOutMessage(options.userMessage)) {
    await client
      .update(leads)
      .set({ optedOut: true, updatedAt: new Date() })
      .where(eq(leads.id, options.leadId));

    const optOutReply =
      detectedLanguage === "gu"
        ? "આપની વિનંતી મુજબ સૂચનાઓ બંધ કરવામાં આવી છે. હવેથી આપને કોઈ સંદેશ કે રીમાઇન્ડર મોકલવામાં આવશે નહીં."
        : detectedLanguage === "hi"
        ? "आपकी सहमति वापस ले ली गई है। अब आपको कोई भी स्वचालित मैसेज या रिमाइंडर नहीं भेजा जाएगा। धन्यवाद।"
        : "You have been opted out of automated notifications and reminders. If you need any assistance in the future, please contact our sales office directly.";

    // Save user and assistant messages
    await client.insert(messages).values([
      {
        conversationId: options.conversationId,
        role: "user",
        content: options.userMessage,
        language: detectedLanguage,
        createdAt: new Date(),
      },
      {
        conversationId: options.conversationId,
        role: "assistant",
        content: optOutReply,
        language: detectedLanguage,
        latencyMs: Date.now() - startTime,
        createdAt: new Date(),
      },
    ]);

    return {
      reply: optOutReply,
      language: detectedLanguage,
      flagged: false,
      latencyMs: Date.now() - startTime,
      payloads: [{ type: "opted_out", message: optOutReply }],
      usedFactIds: [],
    };
  }

  // 2b. Handle ambiguous opt-out queries ("stop messaging", "how to stop", etc.)
  if (isAmbiguousOptOutQuery(options.userMessage)) {
    const promptReply =
      detectedLanguage === "gu"
        ? "શું આપ ઈચ્છો છો કે અમે આપને તમામ સંદેશા મોકલવાનું બંધ કરીએ? જો હા, તો પુષ્ટિ કરવા માટે 'STOP' અથવા 'બંધ કરો' લખો."
        : detectedLanguage === "hi"
        ? "क्या आप चाहते हैं कि हम आपको सभी संदेश भेजना बंद कर दें? यदि हाँ, तो पुष्टि के लिए 'STOP' या 'बंद करो' लिखें।"
        : "Would you like us to stop all messages? If yes, please reply with 'STOP' to confirm your opt-out.";

    await client.insert(messages).values([
      {
        conversationId: options.conversationId,
        role: "user",
        content: options.userMessage,
        language: detectedLanguage,
        createdAt: new Date(),
      },
      {
        conversationId: options.conversationId,
        role: "assistant",
        content: promptReply,
        language: detectedLanguage,
        latencyMs: Date.now() - startTime,
        createdAt: new Date(),
      },
    ]);

    return {
      reply: promptReply,
      language: detectedLanguage,
      flagged: false,
      latencyMs: Date.now() - startTime,
      payloads: [{ type: "ambiguous_opt_out_prompt" }],
      usedFactIds: [],
    };
  }

  // 3. Load conversation history
  const history = await client
    .select({
      role: messages.role,
      content: messages.content,
    })
    .from(messages)
    .where(eq(messages.conversationId, options.conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(20);

  const chatMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT_V1 },
    ...history.map((h: { role: string; content: string }) => ({
      role: h.role as ChatMessage["role"],
      content: h.content,
    })),
    { role: "user", content: options.userMessage },
  ];

  let finalReplyText = "";
  let isFlagged = false;
  let flagReason: string | undefined;

  try {
    // 4. Tool Loop (Maximum 5 iterations)
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const completion = await provider.generateResponse(
        chatMessages,
        AGENT_TOOLS,
        SYSTEM_PROMPT_V1
      );

      // If the model invoked tool calls:
      if (completion.toolCalls && completion.toolCalls.length > 0) {
        // Record assistant's tool-calling intention
        chatMessages.push({
          role: "assistant",
          content: completion.content || "",
          toolCalls: completion.toolCalls,
        });

        for (const tc of completion.toolCalls) {
          const execRes = await executeToolCall(tc, context);

          chatMessages.push({
            role: "tool",
            name: tc.name,
            toolCallId: tc.id,
            content: JSON.stringify(execRes.result),
          });
        }

        // If the model also returned final text alongside tool call, or continue loop
        if (completion.content && completion.content.trim().length > 0 && iterations >= 2) {
          finalReplyText = completion.content.trim();
          break;
        }
      } else {
        // Model provided final text
        finalReplyText = completion.content?.trim() || "";
        break;
      }
    }

    if (!finalReplyText) {
      finalReplyText =
        detectedLanguage === "gu"
          ? "અમદાવાદમાં અમારા પ્રોજેક્ટ્સ વિશે આપને ચોક્કસ માહિતી આપીને મને આનંદ થશે. આપ કઈ વિગત જાણવા માંગો છો?"
          : detectedLanguage === "hi"
          ? "अहमदाबाद में हमारे प्रोजेक्ट्स के बारे में आपकी सहायता करने में मुझे खुशी होगी। आप क्या जानना चाहेंगे?"
          : "I would be happy to assist you with details regarding our residential projects in Ahmedabad. How may I help you?";
    }
  } catch (error) {
    const errorCat = categorizeLlmError(error);
    console.error(`[CHAT FALLBACK] Category: ${errorCat.category} | Reason: ${errorCat.reason}`);

    // Fallback: The chat must never hang or 500
    finalReplyText =
      detectedLanguage === "gu"
        ? "હાલમાં તકનીકી સમસ્યા આવી છે. અમારી સેલ્સ ટીમ ટૂંક સમયમાં આપનો સંપર્ક કરશે."
        : detectedLanguage === "hi"
        ? "तकनीकी समस्या के कारण मैं अभी उत्तर देने में असमर्थ हूँ। हमारी टीम के सदस्य शीघ्र ही आपसे संपर्क करेंगे।"
        : "I'm having trouble right now, a member of our team will contact you shortly.";

    isFlagged = true;
    flagReason = `llm_error: ${errorCat.category}`;

    // Trigger handoff to ensure lead is reached
    await handoffService.createHandoff({
      leadId: options.leadId,
      conversationId: options.conversationId,
      reason: "error",
      notes: flagReason,
      dbOrTx: client,
    });
  }

  // 5. Output Guardrail (Pre-delivery verification)
  const resolvedProjectContext =
    leadRecord?.projectName ||
    leadRecord?.projectLocation ||
    leadRecord?.projectId ||
    options.userMessage ||
    undefined;

  const guardrailCheck = checkPriceGuardrails(
    finalReplyText,
    detectedLanguage,
    resolvedProjectContext
  );
  if (!guardrailCheck.passed) {
    console.warn(`[CHAT FALLBACK] Category: guardrail | Reason: ${guardrailCheck.reason}`);
    finalReplyText = guardrailCheck.fallbackMessage;
    isFlagged = true;
    flagReason = guardrailCheck.reason;

    // Trigger handoff with reason 'guardrail'
    await handoffService.createHandoff({
      leadId: options.leadId,
      conversationId: options.conversationId,
      reason: "guardrail",
      notes: `Price/compliance violation: ${guardrailCheck.reason} (${guardrailCheck.violatingSnippet})`,
      dbOrTx: client,
    });
  }

  const latencyMs = Date.now() - startTime;

  // 6. Save User & Assistant Messages to Database
  await client.insert(messages).values({
    conversationId: options.conversationId,
    role: "user",
    content: options.userMessage,
    language: detectedLanguage,
    createdAt: new Date(),
  });

  const payloadString =
    context.uiPayloads.length > 0 ? JSON.stringify(context.uiPayloads) : null;
  const factIdsString =
    context.usedFactIds.length > 0 ? context.usedFactIds.join(",") : null;

  await client.insert(messages).values({
    conversationId: options.conversationId,
    role: "assistant",
    content: finalReplyText,
    language: detectedLanguage,
    flagged: isFlagged,
    flagReason: flagReason || null,
    latencyMs,
    factIds: factIdsString,
    payload: payloadString,
    createdAt: new Date(),
  });

  // If flagged, mark the conversation record for admin review queue
  if (isFlagged) {
    await client
      .update(conversations)
      .set({
        flagged: true,
        flagReason: flagReason || "compliance_review",
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, options.conversationId));
  }

  // 7. Record first response metric if not yet set
  if (!leadRecord?.firstResponseAt) {
    await setFirstResponseAt(options.leadId, new Date(), client);
  }

  // 8. Recompute Lead Priority Score idempotently after buyer message
  try {
    await recomputeLeadScore(options.leadId, client);
  } catch (err) {
    console.warn("Lead Priority Score recomputation note:", err);
  }

  return {
    reply: finalReplyText,
    language: detectedLanguage,
    flagged: isFlagged,
    flagReason,
    latencyMs,
    payloads: context.uiPayloads,
    usedFactIds: context.usedFactIds,
  };
}
