import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./server/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and internal Next.js requests bypass middleware
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await verifySessionToken(token) : null;

  const isApiRoute = pathname.startsWith("/api/");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Redirect already authenticated users away from login/register
  if (isAuthPage && user) {
    if (user.isAdmin || user.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (user.role === "executive") {
      return NextResponse.redirect(new URL("/executive", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 1. ADMIN ROUTES
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!user) {
      if (isApiRoute) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!user.isAdmin && user.role !== "admin") {
      if (isApiRoute) {
        return NextResponse.json({ success: false, error: "Forbidden: Admin access required" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    return NextResponse.next();
  }

  // 2. EXECUTIVE ROUTES
  if (
    pathname.startsWith("/executive") ||
    pathname.startsWith("/api/executive")
  ) {
    if (!user) {
      if (isApiRoute) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!user.isAdmin && user.role !== "admin" && user.role !== "executive") {
      if (isApiRoute) {
        return NextResponse.json({ success: false, error: "Forbidden: Sales Executive access required" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    return NextResponse.next();
  }

  // 3. BUYER PROTECTED ROUTES
  if (pathname.startsWith("/buyer") || pathname.startsWith("/api/buyer")) {
    if (!user) {
      if (isApiRoute) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/executive/:path*",
    "/api/executive/:path*",
    "/buyer/:path*",
    "/api/buyer/:path*",
    "/login",
    "/register",
  ],
};
