import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const list = await db
    .select({
      id: projects.id,
      name: projects.name,
      locationName: projects.locationName,
      reraNumber: projects.reraNumber,
    })
    .from(projects);

  return NextResponse.json({
    success: true,
    projects: list,
  });
}
