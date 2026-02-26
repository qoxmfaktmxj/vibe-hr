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
const AUTH_COOKIE_REMEMBER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30일

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const loginId = typeof payload?.login_id === "string" ? payload.login_id.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  const remember = payload?.remember === true;

  if (!loginId || !password) {
    return NextResponse.json(
      { detail: "아이디와 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ login_id: loginId, password }),
  });

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { detail: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: upstreamResponse.status === 401 ? 401 : 500 },
    );
  }

  const data = (await upstreamResponse.json()) as LoginResponse;

  const response = NextResponse.json({ user: data.user }, { status: 200 });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: data.access_token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? AUTH_COOKIE_REMEMBER_MAX_AGE_SECONDS : AUTH_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}
