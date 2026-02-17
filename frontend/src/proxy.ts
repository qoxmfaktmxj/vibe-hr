import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "vibe_hr_token";
const PUBLIC_PATHS = new Set(["/login", "/unauthorized"]);

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images") ||
    pathname.includes(".")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const hasAuthToken = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (!hasAuthToken && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
