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

  // 정적 자원 및 API 라우트는 패스
  if (pathname.startsWith("/api") || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const hasAuthToken = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  // 루트 경로: 인증 여부에 따라 리다이렉트
  if (pathname === "/") {
    if (hasAuthToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 미인증 사용자가 보호 페이지 접근 시 → 로그인으로 리다이렉트 (원래 경로 기억)
  if (!hasAuthToken && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
