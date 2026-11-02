import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { getLeadSession } from "@/server/auth/lead-session";
import { bookingService } from "@/server/services/booking";
import { z } from "zod";

const createBookingSchema = z.object({
  slotId: z.string().uuid("Invalid slot ID"),
  leadId: z.string().uuid("Invalid lead ID").optional(),
});

/**
 * POST /api/bookings
 * Schedules a visit slot.
 * Enforces atomic slot lock, DPDP checks, 2h cutoff, and unique index.
 * Security: NEVER accepts leadId from request body for buyer sessions.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const leadSession = await getLeadSession();

    let targetLeadId: string;

    const isStaff = user && (user.role === "executive" || user.role === "admin" || user.isAdmin);

    if (isStaff) {
      // Executives/Admins can provide leadId in body
      const json = await request.json();
      const parsed = createBookingSchema.safeParse(json);

      if (!parsed.success || !parsed.data.leadId) {
        return NextResponse.json(
          { success: false, error: "Validation failed: leadId required for staff bookings" },
          { status: 400 }
        );
      }
      targetLeadId = parsed.data.leadId;

      const result = await bookingService.bookVisit({
        slotId: parsed.data.slotId,
        leadId: targetLeadId,
      });

      if (!result.success) {
        if (result.code === "SLOT_TAKEN") {
          return NextResponse.json(result, { status: 409 });
        }
        return NextResponse.json(result, { status: 400 });
      }

      return NextResponse.json(result, { status: 201 });
    }

    if (leadSession) {
      // Buyer chat session: strictly force leadId from verified session token
      const json = await request.json();
      const parsed = createBookingSchema.safeParse(json);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      // Explicitly reject or ignore spoofed leadId from request body
      targetLeadId = leadSession.leadId;

      const result = await bookingService.bookVisit({
        slotId: parsed.data.slotId,
        leadId: targetLeadId,
      });

      if (!result.success) {
        if (result.code === "SLOT_TAKEN") {
          return NextResponse.json(result, { status: 409 });
        }
        return NextResponse.json(result, { status: 400 });
      }

      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Active executive session or verified buyer chat token required",
      },
      { status: 401 }
    );
  } catch (error) {
    console.error("Book visit API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
