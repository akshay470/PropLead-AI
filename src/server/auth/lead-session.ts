import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const LEAD_SESSION_COOKIE_NAME = "proplead_lead_session";
const LEAD_SESSION_EXPIRATION = "24h";

const DEFAULT_DEV_SECRET = "proplead_ai_super_secret_development_key_minimum_32_bytes";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;
  return new TextEncoder().encode(secret);
}

export interface LeadSessionPayload {
  leadId: string;
  conversationId: string;
}

/**
 * Creates and signs a JWT lead session token for a public chat user.
 */
export async function signLeadSessionToken(
  payload: LeadSessionPayload
): Promise<string> {
  const secretKey = getSecretKey();

  return new SignJWT({
    leadId: payload.leadId,
    conversationId: payload.conversationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(LEAD_SESSION_EXPIRATION)
    .sign(secretKey);
}

/**
 * Verifies and decodes a JWT lead session token.
 * Returns null if token is missing, expired, or invalid.
 */
export async function verifyLeadSessionToken(
  token: string
): Promise<LeadSessionPayload | null> {
  if (!token) return null;

  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (
      !payload.leadId ||
      !payload.conversationId ||
      typeof payload.leadId !== "string" ||
      typeof payload.conversationId !== "string"
    ) {
      return null;
    }

    return {
      leadId: payload.leadId,
      conversationId: payload.conversationId,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves the verified lead session from the request cookies.
 */
export async function getLeadSession(): Promise<LeadSessionPayload | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(LEAD_SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyLeadSessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Sets the httpOnly lead session cookie on a NextResponse.
 */
export function setLeadSessionCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set({
    name: LEAD_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}
