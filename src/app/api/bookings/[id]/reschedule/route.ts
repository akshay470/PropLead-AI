import { NextRequest, NextResponse } from "next/server";
import { bookingService } from "@/server/services/booking";
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
