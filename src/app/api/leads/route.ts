import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { leadService } from "@/server/services/leads";
import { createLeadSchema } from "@/server/services/leads/ingestion";
import { z } from "zod";

const getLeadsQuerySchema = z.object({
  search: z.string().optional(),
  source: z.enum(["property_portal", "social_media_ad", "website", "hoarding_call"]).optional(),
  project: z.string().uuid().optional(),
  status: z.enum(["new", "contacted", "qualified", "visit_scheduled", "visited", "lost"]).optional(),
  assignedExecutive: z.string().uuid().optional(),
  duplicates: z.enum(["only", "exclude", "all"]).default("all"),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/leads
 * Lists leads with filtering, search, and pagination.
 * Restricted to sales executives and admins.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "executive" && user.role !== "admin" && !user.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Executive or Admin access required" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawParams = Object.fromEntries(searchParams.entries());
  const parsed = getLeadsQuerySchema.safeParse(rawParams);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const query = parsed.data;
  const result = await leadService.getLeads({
    search: query.search,
    source: query.source,
    projectId: query.project,
    status: query.status,
    assignedExecutiveId: query.assignedExecutive,
    duplicates: query.duplicates,
    limit: query.limit,
    offset: query.offset,
  });

  return NextResponse.json({
    success: true,
    ...result,
  });
}

/**
 * POST /api/leads
 * Manual lead addition and portal ingestion endpoint.
 * Protected by same deduplication and E.164 normalization engine.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  // Allow internal executives/admins or automated portal ingestion webhook
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "executive" && user.role !== "admin" && !user.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Executive or Admin access required" },
      { status: 403 }
    );
  }

  try {
    const json = await request.json();
    const result = await leadService.createLeadFromEnquiry(json);

    return NextResponse.json(
      {
        success: true,
        lead: result.lead,
        isDuplicate: result.isDuplicate,
        canonicalLead: result.canonicalLead,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    console.error("Error creating lead:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
