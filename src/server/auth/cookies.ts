import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SessionUser,
  createSessionToken,
  verifySessionToken,
} from "./session";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Reads and verifies the current authenticated session from HTTP cookies.
 * Can be called inside Server Components, Route Handlers, and Server Actions.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Sets an HTTP-only session cookie for the authenticated user.
 */
export async function setAuthCookie(user: SessionUser): Promise<string> {
  const token = await createSessionToken(user);
  const cookieStore = cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return token;
}

/**
 * Clears the session cookie to log the user out.
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
