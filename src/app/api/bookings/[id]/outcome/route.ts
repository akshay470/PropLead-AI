import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { bookingService } from "@/server/services/booking";
import { z } from "zod";

const outcomeSchema = z.object({
  outcome: z.enum(["visited", "no_show"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "executive" && user.role !== "admin" && !user.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Executive access required" },
      { status: 403 }
    );
  }

  const { id } = params;

  try {
    const json = await request.json();
    const parsed = outcomeSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await bookingService.markVisitOutcome({
      bookingId: id,
      outcome: parsed.data.outcome,
      executiveId: user.userId,
      isAdmin: user.isAdmin || user.role === "admin",
    });

    return NextResponse.json({
      success: true,
      booking: updated,
    });
  } catch (error: any) {
    const isForbidden = String(error?.message || "").includes("Forbidden");
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: isForbidden ? 403 : 400 }
    );
  }
}
