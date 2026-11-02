import { NextRequest, NextResponse } from "next/server";
import { bookingService } from "@/server/services/booking";
import { z } from "zod";

const cancelSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(json);

    const result = await bookingService.cancelBooking({
      bookingId: id,
      reason: parsed.success ? parsed.data.reason : undefined,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cancel booking error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
