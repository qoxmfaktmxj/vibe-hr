import { NextRequest, NextResponse } from "next/server";

import type { AuthUser } from "@/types/auth";

type RefreshResponse = {
  access_token: string;
  user: AuthUser;
  access_ttl_min: number;
  refresh_threshold_min: number;
  remember_enabled: boolean;
  remember_ttl_min: number;
  show_countdown: boolean;
};

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const AUTH_COOKIE_NAME = "vibe_hr_token";
const ACCESS_TTL_COOKIE = "vibe_hr_access_ttl_min";
const REFRESH_THRESHOLD_COOKIE = "vibe_hr_refresh_threshold_min";
const SHOW_COUNTDOWN_COOKIE = "vibe_hr_show_countdown";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!upstreamResponse.ok) {
    return NextResponse.json({ detail: "Session refresh failed." }, { status: upstreamResponse.status });
  }

  const data = (await upstreamResponse.json()) as RefreshResponse;
  const accessTtlMin = Number.isFinite(data.access_ttl_min) ? Math.max(5, data.access_ttl_min) : 120;
  const rememberTtlMin = Number.isFinite(data.remember_ttl_min) ? Math.max(60, data.remember_ttl_min) : 60 * 24 * 30;
  const refreshThresholdMin = Number.isFinite(data.refresh_threshold_min)
    ? Math.max(1, data.refresh_threshold_min)
    : Math.floor(accessTtlMin / 2);
  const maxAge = (data.remember_enabled ? rememberTtlMin : accessTtlMin) * 60;

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: data.access_token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  response.cookies.set({ name: ACCESS_TTL_COOKIE, value: String(accessTtlMin), path: "/", maxAge });
  response.cookies.set({ name: REFRESH_THRESHOLD_COOKIE, value: String(refreshThresholdMin), path: "/", maxAge });
  response.cookies.set({ name: SHOW_COUNTDOWN_COOKIE, value: data.show_countdown ? "1" : "0", path: "/", maxAge });

  return response;
}
