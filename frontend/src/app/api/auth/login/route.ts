import { NextRequest, NextResponse } from "next/server";

import type { AuthUser } from "@/types/auth";

type LoginResponse = {
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
const ENTER_CD_COOKIE = "vibe_hr_enter_cd";
const ACCESS_TTL_COOKIE = "vibe_hr_access_ttl_min";
const REFRESH_THRESHOLD_COOKIE = "vibe_hr_refresh_threshold_min";
const SHOW_COUNTDOWN_COOKIE = "vibe_hr_show_countdown";
const REMEMBER_ENABLED_COOKIE = "vibe_hr_remember_enabled";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const enterCd = typeof payload?.enter_cd === "string" ? payload.enter_cd.trim().toUpperCase() : "";
  const loginId = typeof payload?.login_id === "string" ? payload.login_id.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  const remember = payload?.remember === true;

  if (!enterCd || !loginId || !password) {
    return NextResponse.json(
      { detail: "ENTER_CD, 아이디, 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ enter_cd: enterCd, login_id: loginId, password }),
  });

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { detail: "ENTER_CD 또는 로그인 정보가 올바르지 않습니다." },
      { status: upstreamResponse.status === 401 ? 401 : 500 },
    );
  }

  const data = (await upstreamResponse.json()) as LoginResponse;

  const response = NextResponse.json(
    { user: { ...data.user, enter_cd: enterCd } },
    { status: 200 },
  );
  const accessTtlMin = Number.isFinite(data.access_ttl_min) ? Math.max(5, data.access_ttl_min) : 120;
  const rememberTtlMin = Number.isFinite(data.remember_ttl_min) ? Math.max(60, data.remember_ttl_min) : 60 * 24 * 30;
  const refreshThresholdMin = Number.isFinite(data.refresh_threshold_min)
    ? Math.max(1, data.refresh_threshold_min)
    : Math.floor(accessTtlMin / 2);
  const rememberEnabled = data.remember_enabled === true;
  const maxAge = (remember && rememberEnabled ? rememberTtlMin : accessTtlMin) * 60;

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: data.access_token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  response.cookies.set({
    name: ENTER_CD_COOKIE,
    value: enterCd,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  response.cookies.set({ name: ACCESS_TTL_COOKIE, value: String(accessTtlMin), path: "/", maxAge });
  response.cookies.set({ name: REFRESH_THRESHOLD_COOKIE, value: String(refreshThresholdMin), path: "/", maxAge });
  response.cookies.set({ name: SHOW_COUNTDOWN_COOKIE, value: data.show_countdown ? "1" : "0", path: "/", maxAge });
  response.cookies.set({
    name: REMEMBER_ENABLED_COOKIE,
    value: remember && rememberEnabled ? "1" : "0",
    path: "/",
    maxAge,
  });

  return response;
}
