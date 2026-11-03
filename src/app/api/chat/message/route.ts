import { NextRequest, NextResponse } from "next/server";
import { getLeadSession } from "@/server/auth/lead-session";
import { checkSessionRateLimit, checkIpRateLimit } from "@/server/ai/rate-limiter";
import { runAgentTurn } from "@/server/ai/agent";
import { messageSchema } from "@/server/ai/schemas";

const postMessageSchema = messageSchema;

/**
 * POST /api/chat/message
 * Sends a message in the active buyer chat session.
 * Enforces session token authentication, DB-backed rate limiting, and 1000-char max cap.
 * Orchestrates multi-turn tool calling, fact grounding, price guardrails, and metrics.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate Lead Session
    const session = await getLeadSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Active chat session token required. Please start a session first.",
        },
        { status: 401 }
      );
    }

    // 2. Rate Limiting Check (Session & IP)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const sessionLimit = await checkSessionRateLimit(session.leadId);
    if (sessionLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please wait a few seconds before sending another message.",
        },
        { status: 429 }
      );
    }

    const ipLimit = await checkIpRateLimit(ip);
    if (ipLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests from this network address. Please wait a moment.",
        },
        { status: 429 }
      );
    }

    // 3. Validate Message Input
    const json = await request.json();
    const parsed = postMessageSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 4. Run Autonomous Agent Turn
    const turnResult = await runAgentTurn({
      leadId: session.leadId,
      conversationId: session.conversationId,
      userMessage: parsed.data.message,
    });

    return NextResponse.json({
      success: true,
      reply: turnResult.reply,
      language: turnResult.language,
      flagged: turnResult.flagged,
      latencyMs: turnResult.latencyMs,
      payloads: turnResult.payloads,
    });
  } catch (error) {
    console.error("Chat message API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error processing message",
      },
      { status: 500 }
    );
  }
}
