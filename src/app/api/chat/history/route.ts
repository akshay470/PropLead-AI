import { NextResponse } from "next/server";
import { getLeadSession } from "@/server/auth/lead-session";
import { db } from "@/server/db";
import { messages } from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";

/**
 * GET /api/chat/history
 * Returns the chronological transcript of the active buyer conversation.
 */
export async function GET() {
  try {
    const session = await getLeadSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active chat session required" },
        { status: 401 }
      );
    }

    const messageRows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        language: messages.language,
        payload: messages.payload,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, session.conversationId))
      .orderBy(asc(messages.createdAt));

    const formatted = messageRows.map((m) => {
      let parsedPayload = null;
      if (m.payload) {
        try {
          parsedPayload = JSON.parse(m.payload);
        } catch {
          parsedPayload = null;
        }
      }
      return {
        ...m,
        payload: parsedPayload,
      };
    });

    return NextResponse.json({
      success: true,
      conversationId: session.conversationId,
      messages: formatted,
    });
  } catch (error) {
    console.error("Chat history API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
