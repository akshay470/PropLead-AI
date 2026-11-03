import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Public health-check endpoint for uptime monitors, container readiness, and deployment verification.
 * Tests database connectivity via a lightweight query.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  try {
    // Perform a lightweight database ping
    await db.execute(sql`SELECT 1`);
    return NextResponse.json(
      {
        status: "ok",
        timestamp,
        db: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Health check database failure:", error);
    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        db: false,
        error: "Database connectivity error",
      },
      { status: 503 }
    );
  }
}
