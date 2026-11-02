import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { getLeadSession } from "@/server/auth/lead-session";
import { bookingService } from "@/server/services/booking";
import { db } from "@/server/db";
import { bookings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const rescheduleSchema = z.object({
  newSlotId: z.string().uuid("Invalid new slot ID"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const user = await getCurrentUser();
    const leadSession = await getLeadSession();

    const isStaff = user && (user.role === "executive" || user.role === "admin" || user.isAdmin);

    if (!isStaff && !leadSession) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active executive session or buyer session required" },
        { status: 401 }
      );
    }

    // If caller is buyer, verify booking belongs to their session leadId
    if (!isStaff && leadSession) {
      const [existingBooking] = await db
        .select({ id: bookings.id, leadId: bookings.leadId })
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1);

      if (!existingBooking) {
        return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
      }

      if (existingBooking.leadId !== leadSession.leadId) {
        return NextResponse.json(
          { success: false, error: "Forbidden: You cannot reschedule another buyer's appointment" },
          { status: 403 }
        );
      }
    }

    const json = await request.json();
    const parsed = rescheduleSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await bookingService.rescheduleBooking({
      bookingId: id,
      newSlotId: parsed.data.newSlotId,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Reschedule booking error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
