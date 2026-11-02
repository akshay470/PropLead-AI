import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/server/auth/cookies";

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });
}
