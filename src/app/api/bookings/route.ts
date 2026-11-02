import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { bookingService } from "@/server/services/booking";
import { z } from "zod";

const createBookingSchema = z.object({
  slotId: z.string().uuid("Invalid slot ID"),
  leadId: z.string().uuid("Invalid lead ID"),
});

/**
 * POST /api/bookings
 * Schedules a visit slot.
 * Enforces atomic slot lock, DPDP checks, 2h cutoff, and unique index.
 */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = createBookingSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await bookingService.bookVisit(parsed.data);

    if (!result.success) {
      if (result.code === "SLOT_TAKEN") {
        return NextResponse.json(result, { status: 409 });
      }
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Book visit API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
