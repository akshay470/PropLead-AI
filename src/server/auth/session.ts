import { SignJWT, jwtVerify } from "jose";
import { env } from "@/env";

export const SESSION_COOKIE_NAME = "proplead_session";
const SESSION_EXPIRATION = "7d";

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  role: "buyer" | "executive" | "admin";
  isAdmin: boolean;
}

/**
 * Creates and signs a JWT session token for the user.
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const secretKey = getSecretKey();

  return new SignJWT({
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION)
    .sign(secretKey);
}

/**
 * Verifies and decodes a JWT session token.
 * Returns null if token is expired, tampered with, or invalid.
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (
      !payload.userId ||
      !payload.email ||
      !payload.role ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      name: (payload.name as string) || "",
      email: payload.email,
      role: payload.role as "buyer" | "executive" | "admin",
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}
