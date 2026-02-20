import { NextRequest, NextResponse } from "next/server";

import type { AuthUser } from "@/types/auth";

type LoginResponse = {
  access_token: string;
  user: AuthUser;
};

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const AUTH_COOKIE_NAME = "vibe_hr_token";
const tokenExpiresEnv = Number(process.env.AUTH_TOKEN_EXPIRES_MIN ?? "480");
const AUTH_TOKEN_EXPIRES_MIN =
  Number.isFinite(tokenExpiresEnv) && tokenExpiresEnv > 0 ? tokenExpiresEnv : 480;
const AUTH_COOKIE_MAX_AGE_SECONDS = Math.max(60, AUTH_TOKEN_EXPIRES_MIN * 60);

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const userId =
    typeof payload?.user_id === "number" && Number.isInteger(payload.user_id)
      ? payload.user_id
      : 0;
  if (userId <= 0) {
    return NextResponse.json({ detail: "전환 대상 사용자 ID가 필요합니다." }, { status: 400 });
  }

  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/auth/impersonation/login`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ user_id: userId }),
  });

  const data = (await upstreamResponse.json().catch(() => null)) as LoginResponse | { detail?: string } | null;
  if (!upstreamResponse.ok || !data || !("access_token" in data)) {
    return NextResponse.json(
      { detail: (data as { detail?: string } | null)?.detail ?? "전환 로그인에 실패했습니다." },
      { status: upstreamResponse.status || 500 },
    );
  }

  const response = NextResponse.json({ user: data.user }, { status: 200 });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: data.access_token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
