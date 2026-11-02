import {
  ILlmProvider,
  ChatMessage,
  ToolDefinition,
  LlmCompletionResponse,
  ToolCall,
} from "./types";

/**
 * Robust Mock LLM Provider for deterministic testing, CI, and local development.
 * Simulates tool calling and multilingual responses without incurring API costs.
 */
export class MockLlmProvider implements ILlmProvider {
  name = "mock";
  private cannedResponses: Array<(messages: ChatMessage[]) => LlmCompletionResponse | null> = [];

  constructor(customHandler?: (messages: ChatMessage[]) => LlmCompletionResponse | null) {
    if (customHandler) {
      this.cannedResponses.push(customHandler);
    }
  }

  setResponseHandler(handler: (messages: ChatMessage[]) => LlmCompletionResponse | null) {
    this.cannedResponses = [handler];
  }

  async generateResponse(
    messages: ChatMessage[],
    _tools?: ToolDefinition[],
    _systemPrompt?: string
  ): Promise<LlmCompletionResponse> {
    // 1. Check custom handlers
    for (const handler of this.cannedResponses) {
      const custom = handler(messages);
      if (custom) return custom;
    }

    const lastMsg = [...messages].reverse().find((m) => m.role === "user");
    const lastToolMsg = [...messages].reverse().find((m) => m.role === "tool");
    const text = (lastMsg?.content || "").toLowerCase();

    // 2. If responding to a tool execution:
    if (messages[messages.length - 1]?.role === "tool") {
      const toolContent = messages[messages.length - 1].content;
      try {
        const parsed = JSON.parse(toolContent);
        if (parsed.found && parsed.facts?.length > 0) {
          const fact = parsed.facts[0];
          return {
            content: `According to our official Gujarat RERA fact sheet: ${fact.answer}`,
            language: "en",
          };
        }
        if (parsed.found === false) {
          return {
            content:
              "I don't have that specific verified detail in our registered fact sheet. Let me connect you directly with our sales team who can confirm that for you.",
            toolCalls: [
              {
                id: `call_${Date.now()}`,
                name: "handoff_to_executive",
                arguments: {
                  reason: "missing_fact",
                  summary_notes: "Unanswered inquiry not found in fact sheet",
                },
              },
            ],
            language: "en",
          };
        }
        if (parsed.slots?.length > 0) {
          return {
            content:
              "We have multiple convenient visit slots available over the coming days. You can choose from the timings displayed below to reserve your personal tour.",
            language: "en",
          };
        }
        if (parsed.code === "SLOT_TAKEN") {
          return {
            content:
              "That specific slot was just booked by another buyer. Here are three recommended alternative slots available for your visit:",
            language: "en",
          };
        }
        if (parsed.status === "confirmed") {
          return {
            content:
              "Your site visit appointment is successfully confirmed! Our relationship executive will look forward to welcoming you at the experience gallery.",
            language: "en",
          };
        }
        if (parsed.executiveAssigned) {
          return {
            content: `I've connected you with ${parsed.executiveAssigned} from our sales team. They will reach out to you directly to assist further.`,
            language: "en",
          };
        }
      } catch {
        // pass
      }
    }

    // 3. Human / Person request -> handoff
    if (
      text.includes("person") ||
      text.includes("human") ||
      text.includes("executive") ||
      text.includes("agent") ||
      text.includes("बात करनी है") ||
      text.includes("વાત કરવી છે")
    ) {
      return {
        content: "I will immediately connect you with a member of our sales team.",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "handoff_to_executive",
            arguments: { reason: "buyer_requested" },
          },
        ],
        language: text.includes("વાત") ? "gu" : text.includes("बात") ? "hi" : "en",
      };
    }

    // 4. Missing fact trigger (e.g. asking for pets, school distance, metro, etc. not in fact sheet)
    if (
      text.includes("pet") ||
      text.includes("dog") ||
      text.includes("competitor") ||
      text.includes("unknown fact") ||
      text.includes("helipad")
    ) {
      return {
        content: "",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "get_fact",
            arguments: { query: "pet policy" },
          },
        ],
        language: "en",
      };
    }

    // 5. Pricing queries -> get_fact
    if (text.includes("price") || text.includes("cost") || text.includes("कीमत") || text.includes("કિંમત") || text.includes("budget")) {
      return {
        content: "",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "get_fact",
            arguments: { category: "Pricing", query: "pricing" },
          },
        ],
        language: text.includes("કિંમત") ? "gu" : text.includes("कीमत") ? "hi" : "en",
      };
    }

    // 6. Amenities queries -> get_fact
    if (text.includes("amenities") || text.includes("clubhouse") || text.includes("gym") || text.includes("सुविधा") || text.includes("સુવિધા")) {
      return {
        content: "",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "get_fact",
            arguments: { category: "Amenities", query: "amenities" },
          },
        ],
        language: text.includes("સુવિધા") ? "gu" : text.includes("सुविधा") ? "hi" : "en",
      };
    }

    // 7. RERA and Registration queries -> get_fact
    if (text.includes("rera") || text.includes("registration") || text.includes("approval")) {
      return {
        content: "",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "get_fact",
            arguments: { category: "RERA Details", query: "rera" },
          },
        ],
        language: "en",
      };
    }

    // 8. Possession date queries -> get_fact
    if (text.includes("possession") || text.includes("ready") || text.includes("handover")) {
      return {
        content: "",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "get_fact",
            arguments: { category: "Possession", query: "possession" },
          },
        ],
        language: "en",
      };
    }

    // 9. Parking queries -> get_fact
    if (text.includes("parking") || text.includes("car park")) {
      return {
        content: "",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "get_fact",
            arguments: { category: "Parking", query: "parking" },
          },
        ],
        language: "en",
      };
    }

    // 10. Visit timings / sample flat queries -> get_fact
    if (text.includes("sample flat") || text.includes("timing") || text.includes("what time") || text.includes("hours")) {
      return {
        content: "",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "get_fact",
            arguments: { category: "Visit Guidelines", query: "timings" },
          },
        ],
        language: "en",
      };
    }

    // 11. Visit booking queries -> list_free_slots
    if (
      text.includes("visit") ||
      text.includes("slot") ||
      text.includes("book") ||
      text.includes("देखना") ||
      text.includes("જોવું")
    ) {
      return {
        content: "Let me check available visit slots for you.",
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: "list_free_slots",
            arguments: { projectId: "00000000-0000-0000-0000-000000000001" }, // will be substituted with session project
          },
        ],
        language: text.includes("જોવું") ? "gu" : text.includes("देखना") ? "hi" : "en",
      };
    }

    // 8. Hindi greetings
    if (text.includes("नमस्ते") || text.includes("नमस्कार")) {
      return {
        content:
          "नमस्ते! मैं कंपनी ए का वर्चुअल असिस्टेंट हूँ। मैं बोपल और बोडकदेव में हमारे प्रोजेक्ट्स के बारे में आपकी कैसे सहायता कर सकता हूँ?",
        language: "hi",
      };
    }

    // 9. Gujarati greetings
    if (text.includes("કેમ છો") || text.includes("નમસ્તે")) {
      return {
        content:
          "નમસ્તે! હું કંપની એ નો સહાયક છું. અમદાવાદમાં અમારા પ્રોજેક્ટ્સ 1 અને 2 વિશે આપને કઈ માહિતી જોઈએ છે?",
        language: "gu",
      };
    }

    // Default polite response
    return {
      content:
        "Welcome to Company A. We offer premium 2 and 3 BHK residences across Bodakdev and Shela in Ahmedabad. How may I assist you today?",
      language: "en",
    };
  }
}

/**
 * Real Google Gemini Provider using REST API with timeout and retry logic.
 */
export class GeminiProvider implements ILlmProvider {
  name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || "";
    this.model = model || process.env.LLM_MODEL || "gemini-1.5-flash";
  }

  async generateResponse(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    systemPrompt?: string
  ): Promise<LlmCompletionResponse> {
    if (!this.apiKey) {
      console.warn("GeminiProvider: No LLM_API_KEY provided; falling back to MockLlmProvider.");
      const mock = new MockLlmProvider();
      return mock.generateResponse(messages, tools, systemPrompt);
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    // Transform messages to Gemini contents
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    for (const m of messages) {
      if (m.role === "system") continue;

      if (m.role === "user") {
        contents.push({ role: "user", parts: [{ text: m.content }] });
      } else if (m.role === "assistant") {
        const parts: Array<Record<string, unknown>> = [];
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.arguments,
              },
            });
          }
        }
        contents.push({ role: "model", parts });
      } else if (m.role === "tool") {
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: m.name || "tool_result",
                response: { content: m.content },
              },
            },
          ],
        });
      }
    }

    // Format function declarations
    const geminiTools =
      tools && tools.length > 0
        ? [
            {
              function_declarations: tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          ]
        : undefined;

    const requestPayload: Record<string, unknown> = {
      contents,
    };

    if (systemPrompt) {
      requestPayload.system_instruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    if (geminiTools) {
      requestPayload.tools = geminiTools;
    }

    // Execution with 10s timeout & 1 retry
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini API error status ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        let replyText = "";
        const toolCalls: ToolCall[] = [];

        for (const p of parts) {
          if (p.text) replyText += p.text;
          if (p.functionCall) {
            toolCalls.push({
              id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: p.functionCall.name,
              arguments: p.functionCall.args || {},
            });
          }
        }

        return {
          content: replyText.trim(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          language: "en",
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (attempts >= 2) throw err;
      }
    }

    throw new Error("Gemini generation failed after retries.");
  }
}

/**
 * Factory to retrieve the configured LLM provider.
 */
export function getLlmProvider(): ILlmProvider {
  const provider = (process.env.LLM_PROVIDER || "mock").toLowerCase();

  if ((provider === "gemini" || provider === "google") && process.env.LLM_API_KEY) {
    return new GeminiProvider();
  }

  return new MockLlmProvider();
}
