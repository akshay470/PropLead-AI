export type SupportedLanguage = "en" | "hi" | "gu";

export interface ToolDefinition {
  name:
    | "get_fact"
    | "list_free_slots"
    | "book_visit"
    | "handoff_to_executive"
    | "save_lead_details"
    | "flag_conversation";
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface LlmCompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  language?: SupportedLanguage;
  flagged?: boolean;
  flagReason?: string;
}

export interface ILlmProvider {
  name: string;
  generateResponse(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    systemPrompt?: string
  ): Promise<LlmCompletionResponse>;
}
