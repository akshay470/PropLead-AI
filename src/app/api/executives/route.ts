import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/cookies";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { or, eq } from "drizzle-orm";

export async function GET() {
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

  const staff = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(or(eq(users.role, "executive"), eq(users.role, "admin")));

  return NextResponse.json({
    success: true,
    executives: staff,
  });
}
