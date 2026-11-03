import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/server/auth/schemas";
import { authService, AuthError } from "@/server/auth/service";
import { setAuthCookie } from "@/server/auth/cookies";
import { checkLoginRateLimit } from "@/server/ai/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const validated = loginSchema.safeParse(json);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Rate limit per IP and per email
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = await checkLoginRateLimit(validated.data.email, clientIp);
    if (rateLimit.limited) {
      const retryAfterSeconds = Math.ceil(rateLimit.resetMs / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${retryAfterSeconds} seconds before trying again.`,
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }

    const user = await authService.login(validated.data);
    await setAuthCookie(user);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
