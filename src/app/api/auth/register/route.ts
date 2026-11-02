import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/server/auth/schemas";
import { authService, AuthError } from "@/server/auth/service";
import { setAuthCookie } from "@/server/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const validated = registerSchema.safeParse(json);

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

    const user = await authService.register(validated.data);
    await setAuthCookie(user);

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Register API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
