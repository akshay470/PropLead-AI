import { NextRequest, NextResponse } from "next/server";
import { bookingService } from "@/server/services/booking";
import { z } from "zod";

const slotsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * GET /api/slots
 * Public, read-only endpoint listing free slots.
 * Strips private executive info and returns executive first name only.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawParams = Object.fromEntries(searchParams.entries());
  const parsed = slotsQuerySchema.safeParse(rawParams);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const slots = await bookingService.listFreeSlots({
      projectId: parsed.data.projectId,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });

    return NextResponse.json({
      success: true,
      slots,
    });
  } catch (error) {
    console.error("List slots error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
