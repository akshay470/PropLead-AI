import { ILlmProvider, ChatMessage, ToolDefinition, LlmCompletionResponse } from "./types";

/**
 * Mock / fallback provider used in testing or when no API keys are provided.
 */
export class MockLlmProvider implements ILlmProvider {
  name = "mock";

  async generateResponse(
    messages: ChatMessage[],
    _tools?: ToolDefinition[]
  ): Promise<LlmCompletionResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const content = lastUserMessage?.content || "";

    return {
      content: `[Mock AI Response in English/Hindi/Gujarati] Received: "${content}". Fact sheet rules strictly adhered to.`,
      language: "en",
      flagged: false,
    };
  }
}

/**
 * Provider factory enabling model and vendor swapping from environment configuration.
 */
export function getLlmProvider(): ILlmProvider {
  const provider = process.env.LLM_PROVIDER || "mock";

  switch (provider.toLowerCase()) {
    case "gemini":
    case "google":
      // In subsequent steps, full Gemini tool-calling client will be wired
      return new MockLlmProvider();
    case "openai":
      return new MockLlmProvider();
    default:
      return new MockLlmProvider();
  }
}
