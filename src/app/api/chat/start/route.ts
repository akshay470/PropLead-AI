import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { conversations, messages, projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { leadService } from "@/server/services/leads";
import { signLeadSessionToken, setLeadSessionCookie } from "@/server/auth/lead-session";

const startChatSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(8, "Valid phone number required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  projectId: z.string().uuid("Invalid project ID").optional().or(z.literal("")),
  language: z.enum(["en", "hi", "gu"]).optional(),
  source: z.enum(["property_portal", "social_media_ad", "website", "hoarding_call"]).optional().default("website"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Affirmative DPDP Act 2023 consent is required to start enquiry." }),
  }),
});

/**
 * POST /api/chat/start
 * Public onboarding endpoint for prospective buyers.
 * Enforces DPDP consent, normalizes phone, runs deduplication,
 * creates conversation session, and issues signed lead session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = startChatSchema.safeParse(json);

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

    const { name, phone, email, projectId, language, source, consent } = parsed.data;

    // 1. Ingest or Match Lead (E.164 normalization + deduplication)
    const ingestionResult = await leadService.createLeadFromEnquiry({
      name,
      phone,
      email: email || undefined,
      projectId: projectId || undefined,
      language: language || "en",
      source: source || "website",
      consentGiven: consent,
    });

    const activeLead = ingestionResult.lead;

    // 2. Fetch Project info for welcome context
    let projectName = "our residential projects";
    if (activeLead.projectId) {
      const [p] = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, activeLead.projectId))
        .limit(1);
      if (p) projectName = p.name;
    }

    // 3. Create Conversation Record
    const [conversation] = await db
      .insert(conversations)
      .values({
        leadId: activeLead.id,
        projectId: activeLead.projectId || null,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 4. Formulate Welcome Message
    const welcomeMsg =
      language === "gu"
        ? `નમસ્તે ${name}! હું કંપની એ નો વર્ચ્યુઅલ સેલ્સ આસિસ્ટન્ટ છું. ${projectName} અને અમદાવાદમાં અમારા 2 અને 3 BHK પ્રોજેક્ટ્સ વિશે આપને કઈ માહિતી જોઈએ છે?`
        : language === "hi"
        ? `नमस्ते ${name}! मैं कंपनी ए का वर्चुअल असिस्टेंट हूँ। मैं ${projectName} और अहमदाबाद में हमारे 2 और 3 BHK प्रोजेक्ट्स के बारे में आपकी कैसे सहायता कर सकता हूँ?`
        : `Hello ${name}! Welcome to Company A. I am here to help you explore ${projectName} and our luxury 2 & 3 BHK residences across Ahmedabad. How may I assist you today?`;

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "assistant",
      content: welcomeMsg,
      language: language || "en",
      createdAt: new Date(),
    });

    // 5. Sign Lead Session Token (scoped to this lead and conversation)
    const sessionToken = await signLeadSessionToken({
      leadId: activeLead.id,
      conversationId: conversation.id,
    });

    const response = NextResponse.json(
      {
        success: true,
        conversationId: conversation.id,
        leadId: activeLead.id,
        leadCode: activeLead.leadCode,
        name: activeLead.name,
        welcomeMessage: welcomeMsg,
      },
      { status: 201 }
    );

    // Set HttpOnly session cookie
    setLeadSessionCookie(response, sessionToken);

    return response;
  } catch (error) {
    console.error("Start chat error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
