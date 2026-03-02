import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const AUTH_COOKIE_NAME = "vibe_hr_token";
const ACCESS_TTL_COOKIE = "vibe_hr_access_ttl_min";
const REFRESH_THRESHOLD_COOKIE = "vibe_hr_refresh_threshold_min";
const SHOW_COUNTDOWN_COOKIE = "vibe_hr_show_countdown";
const PUBLIC_PATHS = new Set(["/login", "/unauthorized"]);

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images") ||
    pathname.includes(".")
  );
}

function shouldSkipForRefresh(pathname: string): boolean {
  if (pathname.startsWith("/api/auth/login")) return true;
  if (pathname.startsWith("/api/auth/logout")) return true;
  if (pathname.startsWith("/api/auth/refresh")) return true;
  if (pathname.startsWith("/api/auth/session")) return true;
  return false;
}

function decodeJwtPayload(token: string): { exp?: number; iat?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as { exp?: number; iat?: number };
  } catch {
    return null;
  }
}

async function refreshIfNeeded(request: NextRequest): Promise<{
  token?: string;
  accessTtlMin?: number;
  refreshThresholdMin?: number;
  rememberEnabled?: boolean;
  rememberTtlMin?: number;
  showCountdown?: boolean;
}> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return {};

  const payload = decodeJwtPayload(token);
  if (!payload?.exp || !payload?.iat) return {};

  const now = Math.floor(Date.now() / 1000);
  const remainingSec = payload.exp - now;
  if (remainingSec <= 0) return {};

  const ttlMinCookie = Number(request.cookies.get(ACCESS_TTL_COOKIE)?.value ?? "0");
  const thresholdCookie = Number(request.cookies.get(REFRESH_THRESHOLD_COOKIE)?.value ?? "0");

  const ttlMin = Number.isFinite(ttlMinCookie) && ttlMinCookie > 0
    ? ttlMinCookie
    : Math.max(1, Math.floor((payload.exp - payload.iat) / 60));
  const thresholdMin = Number.isFinite(thresholdCookie) && thresholdCookie > 0
    ? thresholdCookie
    : Math.max(1, Math.floor(ttlMin / 2));

  if (remainingSec > thresholdMin * 60) return {};

  const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  }).catch(() => null);

  if (!refreshResponse || !refreshResponse.ok) return {};

  const data = (await refreshResponse.json().catch(() => null)) as {
    access_token?: string;
    access_ttl_min?: number;
    refresh_threshold_min?: number;
    remember_enabled?: boolean;
    remember_ttl_min?: number;
    show_countdown?: boolean;
  } | null;

  if (!data?.access_token) return {};

  return {
    token: data.access_token,
    accessTtlMin: data.access_ttl_min,
    refreshThresholdMin: data.refresh_threshold_min,
    rememberEnabled: data.remember_enabled,
    rememberTtlMin: data.remember_ttl_min,
    showCountdown: data.show_countdown,
  };
}

function applyRefreshedCookies(
  response: NextResponse,
  refreshed: {
    token?: string;
    accessTtlMin?: number;
    refreshThresholdMin?: number;
    rememberEnabled?: boolean;
    rememberTtlMin?: number;
    showCountdown?: boolean;
  },
): void {
  if (!refreshed.token) return;

  const accessTtlMin = Number.isFinite(refreshed.accessTtlMin) ? Math.max(5, refreshed.accessTtlMin ?? 120) : 120;
  const rememberTtlMin = Number.isFinite(refreshed.rememberTtlMin) ? Math.max(60, refreshed.rememberTtlMin ?? 43200) : 43200;
  const thresholdMin = Number.isFinite(refreshed.refreshThresholdMin)
    ? Math.max(1, refreshed.refreshThresholdMin ?? Math.floor(accessTtlMin / 2))
    : Math.floor(accessTtlMin / 2);
  const maxAge = ((refreshed.rememberEnabled ?? true) ? rememberTtlMin : accessTtlMin) * 60;

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: refreshed.token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  response.cookies.set({ name: ACCESS_TTL_COOKIE, value: String(accessTtlMin), path: "/", maxAge });
  response.cookies.set({ name: REFRESH_THRESHOLD_COOKIE, value: String(thresholdMin), path: "/", maxAge });
  response.cookies.set({ name: SHOW_COUNTDOWN_COOKIE, value: refreshed.showCountdown ? "1" : "0", path: "/", maxAge });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const hasAuthToken = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (pathname === "/") {
    if (hasAuthToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!hasAuthToken && !isPublicPath && !pathname.startsWith("/api")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (shouldSkipForRefresh(pathname)) {
    return NextResponse.next();
  }

  const refreshed = await refreshIfNeeded(request);
  const response = NextResponse.next();
  applyRefreshedCookies(response, refreshed);
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
