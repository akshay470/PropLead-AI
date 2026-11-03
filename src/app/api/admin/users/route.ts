import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { createStaffUserSchema } from "@/server/auth/schemas";
import { authService, AuthError } from "@/server/auth/service";

/**
 * POST /api/admin/users
 * Admin-only endpoint for provisioning sales executive and administrator accounts.
 * Role protected: Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Sales Head admin access required" },
        { status: 403 }
      );
    }

    const json = await request.json();
    const validated = createStaffUserSchema.safeParse(json);

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

    const created = await authService.createStaffUser(validated.data);

    return NextResponse.json(
      {
        success: true,
        user: created,
        message: `Staff account (${created.role}) created successfully`,
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

    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
