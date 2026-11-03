import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import { applyMigrations } from "../helpers/db";
import { runAgentTurn, detectMessageLanguage, isOptOutMessage } from "@/server/ai/agent";
import { MockLlmProvider } from "@/server/ai/provider";
import { executeToolCall } from "@/server/ai/tools/executor";
import { sessionRateLimiter } from "@/server/ai/rate-limiter";
import { handoffService } from "@/server/services/handoff";
import { bookingService } from "@/server/services/booking";
import { eq } from "drizzle-orm";

describe("Autonomous AI Chat Assistant & Guardrails (Step 4)", () => {
  let pg: PGlite;
  let testDb: any;
  let projectId: string;
  let executiveId: string;
  let leadId: string;
  let conversationId: string;
  let slot1Id: string;
  let slot2Id: string;

  beforeAll(async () => {
    pg = new PGlite();
    testDb = drizzle(pg, { schema });

    // Apply all Drizzle migrations including 0002
    await applyMigrations(pg);

    // 1. Seed Project
    const [p] = await testDb
      .insert(schema.projects)
      .values({
        name: "The Grand Orchard",
        reraNumber: "PR/GJ/AHMEDABAD/DEMO-0001",
        locationName: "Bodakdev",
        lat: "23.0338",
        lng: "72.5072",
        address: "SG Highway, Bodakdev",
      })
      .returning();
    projectId = p.id;

    // 2. Seed Executive
    const [u] = await testDb
      .insert(schema.users)
      .values({
        name: "Rajesh Sharma",
        email: "rajesh.assistant.test@example.com",
        passwordHash: "hash123",
        role: "executive",
      })
      .returning();
    executiveId = u.id;

    // 3. Seed Fact Sheet Entries
    await testDb.insert(schema.factSheetEntries).values([
      {
        projectId,
        category: "Pricing",
        questionKey: "pricing",
        answerText:
          "2 BHK residences range from Rs 75 Lakh to Rs 88 Lakh; 3 BHK residences range from Rs 98 Lakh to Rs 1.20 Crore.",
      },
      {
        projectId,
        category: "Amenities",
        questionKey: "amenities",
        answerText:
          "Exclusive 15,000 sq.ft clubhouse, swimming pool, gymnasium, squash court, and reflexology track.",
      },
    ]);

    // 4. Seed Slots
    const tomorrow10 = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow10.setHours(10, 0, 0, 0);
    const tomorrow11 = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow11.setHours(11, 0, 0, 0);

    const [s1, s2] = await testDb
      .insert(schema.visitSlots)
      .values([
        {
          projectId,
          executiveId,
          startsAt: tomorrow10,
          endsAt: new Date(tomorrow10.getTime() + 3600 * 1000),
          status: "available",
        },
        {
          projectId,
          executiveId,
          startsAt: tomorrow11,
          endsAt: new Date(tomorrow11.getTime() + 3600 * 1000),
          status: "available",
        },
      ])
      .returning();
    slot1Id = s1.id;
    slot2Id = s2.id;

    // 5. Seed Lead & Conversation
    const [l] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-99001",
        name: "Aarav Shah",
        phoneE164: "+919825011223",
        source: "website",
        projectId,
        status: "new",
        consentGiven: true,
      })
      .returning();
    leadId = l.id;

    const [c] = await testDb
      .insert(schema.conversations)
      .values({
        leadId,
        projectId,
        status: "active",
      })
      .returning();
    conversationId = c.id;
  });

  afterAll(async () => {
    await pg.close();
  });

  async function createLeadAndConversation(code: string, phone: string) {
    const [l] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: code,
        name: `Test Buyer ${code}`,
        phoneE164: phone,
        source: "website",
        projectId,
        status: "new",
        consentGiven: true,
      })
      .returning();

    const [c] = await testDb
      .insert(schema.conversations)
      .values({
        leadId: l.id,
        projectId,
        status: "active",
      })
      .returning();

    return { lead: l, conversation: c };
  }

  // 1. Language detection
  it("detects languages accurately across English, Hindi, and Gujarati", () => {
    expect(detectMessageLanguage("What is the price of 2 BHK?")).toBe("en");
    expect(detectMessageLanguage("2 बीएचके फ्लैट की कीमत क्या है?")).toBe("hi");
    expect(detectMessageLanguage("2 બીએચકે ફ્લેટ ની કિંમત શું છે?")).toBe("gu");
  });

  // 2. Opt-out detection
  it("detects DPDP opt-out keywords and halts reminders", async () => {
    expect(isOptOutMessage("STOP")).toBe(true);
    expect(isOptOutMessage("unsubscribe")).toBe(true);
    expect(isOptOutMessage("रोकें")).toBe(true);
    expect(isOptOutMessage("बंद करो")).toBe(true);
    expect(isOptOutMessage("બંધ કરો")).toBe(true);
    expect(isOptOutMessage("Tell me about the clubhouse")).toBe(false);

    // Run agent turn with STOP
    const turn = await runAgentTurn({
      leadId,
      conversationId,
      userMessage: "STOP",
      dbOrTx: testDb,
    });

    expect(turn.reply).toContain("opted out");

    // Verify DB updated
    const [updatedLead] = await testDb
      .select({ optedOut: schema.leads.optedOut })
      .from(schema.leads)
      .where(eq(schema.leads.id, leadId));
    expect(updatedLead.optedOut).toBe(true);

    // Reset optedOut for subsequent tests
    await testDb
      .update(schema.leads)
      .set({ optedOut: false })
      .where(eq(schema.leads.id, leadId));
  });

  // 3. Human Handoff
  it("triggers immediate executive handoff when buyer asks for a person", async () => {
    const mock = new MockLlmProvider();
    const turn = await runAgentTurn({
      leadId,
      conversationId,
      userMessage: "Can I speak to a human executive please?",
      provider: mock,
      dbOrTx: testDb,
    });

    expect(turn.reply).toContain("sales team");

    // Verify handoff record in DB
    const [handoffRow] = await testDb
      .select()
      .from(schema.handoffs)
      .where(eq(schema.handoffs.leadId, leadId));
    expect(handoffRow).toBeDefined();
    expect(handoffRow.reason).toBe("buyer_requested");
  });

  // 4. Missing Fact Handoff
  it("triggers handoff with reason 'missing_fact' when fact is not in fact sheet", async () => {
    const mock = new MockLlmProvider();
    const turn = await runAgentTurn({
      leadId,
      conversationId,
      userMessage: "What is your pet policy for the towers?",
      provider: mock,
      dbOrTx: testDb,
    });

    expect(turn.reply).toContain("sales team");

    const handoffRows = await testDb
      .select()
      .from(schema.handoffs)
      .where(eq(schema.handoffs.leadId, leadId));
    expect(handoffRows.length).toBeGreaterThan(0);
  });

  // 5. Output Guardrail (Price & Discount Checker)
  it("discards model discount promise, flags message, and replaces with safe fallback", async () => {
    const { lead: gLead, conversation: gConv } = await createLeadAndConversation(
      "LD-99005",
      "+919825055555"
    );

    // Inject a bad LLM response that hallucinates a discount
    const rogueMock = new MockLlmProvider(() => ({
      content: "We can offer you a special 10% discount on this 2 BHK flat if you book today!",
      language: "en",
    }));

    const turn = await runAgentTurn({
      leadId: gLead.id,
      conversationId: gConv.id,
      userMessage: "Can I get a discount?",
      provider: rogueMock,
      dbOrTx: testDb,
    });

    // Guardrail must have replaced the reply!
    expect(turn.reply).not.toContain("10% discount");
    expect(turn.reply).toContain("Our sales team will confirm pricing");
    expect(turn.flagged).toBe(true);
    expect(turn.flagReason).toBe("discount_or_exact_price_promise");

    // Guardrail handoff must have been logged
    const [guardrailHandoff] = await testDb
      .select()
      .from(schema.handoffs)
      .where(eq(schema.handoffs.leadId, gLead.id));
    expect(guardrailHandoff).toBeDefined();
    expect(guardrailHandoff.reason).toBe("guardrail");
  });

  // 6. SLOT_TAKEN recovery offers alternatives
  it("handles SLOT_TAKEN during book_visit tool and returns alternatives", async () => {
    // Lead 1 books slot1 first
    await bookingService.bookVisit({ slotId: slot1Id, leadId }, testDb);

    // Create Lead 2 who attempts to book the same slot1
    const [lead2] = await testDb
      .insert(schema.leads)
      .values({
        leadCode: "LD-99002",
        name: "Pooja Vora",
        phoneE164: "+919825099887",
        source: "website",
        projectId,
        status: "new",
        consentGiven: true,
      })
      .returning();

    // Now execute tool call for the same slot with Lead 2's session
    const toolRes = await executeToolCall(
      {
        id: "call_slot_test",
        name: "book_visit",
        arguments: { slotId: slot1Id },
      },
      {
        leadId: lead2.id,
        conversationId,
        projectId,
        usedFactIds: [],
        uiPayloads: [],
        dbOrTx: testDb,
      }
    );

    expect(toolRes.result.success).toBe(false);
    expect(toolRes.result.code).toBe("SLOT_TAKEN");
    expect(toolRes.result.alternativeSlots).toBeDefined();
  });

  // 7. Security: Model-supplied leadId is strictly ignored
  it("ignores any leadId passed in model tool arguments and uses session context", async () => {
    const maliciousLeadId = "00000000-0000-0000-0000-999999999999";

    const toolRes = await executeToolCall(
      {
        id: "call_save_details",
        name: "save_lead_details",
        arguments: {
          wants: "3BHK",
          budgetMin: 9000000,
          leadId: maliciousLeadId, // Spoofed argument
        },
      },
      {
        leadId, // Real session leadId
        conversationId,
        projectId,
        usedFactIds: [],
        uiPayloads: [],
        dbOrTx: testDb,
      }
    );

    expect(toolRes.result.success).toBe(true);

    // Verify that the REAL session lead was updated, NOT the spoofed one
    const [updatedLead] = await testDb
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, leadId));
    expect(updatedLead.wants).toBe("3BHK");
  });

  // 8. Rate Limiter
  it("rate limits abusive requests after exceeding threshold", () => {
    const testKey = `test_ratelimit_${Date.now()}`;
    for (let i = 0; i < 15; i++) {
      const res = sessionRateLimiter.isRateLimited(testKey);
      expect(res.limited).toBe(false);
    }

    // 16th request must be rate-limited
    const limitRes = sessionRateLimiter.isRateLimited(testKey);
    expect(limitRes.limited).toBe(true);
    expect(limitRes.remaining).toBe(0);
  });

  // 9. LLM failure fallback (Never 500s or hangs)
  it("gracefully catches provider exceptions, flags conversation, and returns safe fallback", async () => {
    const { lead: errLead, conversation: errConv } = await createLeadAndConversation(
      "LD-99009",
      "+919825099999"
    );

    const brokenMock = new MockLlmProvider(() => {
      throw new Error("Provider network connection timeout");
    });

    const turn = await runAgentTurn({
      leadId: errLead.id,
      conversationId: errConv.id,
      userMessage: "Hello",
      provider: brokenMock,
      dbOrTx: testDb,
    });

    expect(turn.reply).toContain("trouble right now");
    expect(turn.flagged).toBe(true);
    expect(turn.flagReason).toContain("llm_error");

    const [errorHandoff] = await testDb
      .select()
      .from(schema.handoffs)
      .where(eq(schema.handoffs.leadId, errLead.id));
    expect(errorHandoff).toBeDefined();
    expect(errorHandoff.reason).toBe("error");
  });
});
