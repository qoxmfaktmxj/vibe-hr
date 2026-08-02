import { NextRequest, NextResponse } from "next/server";

import {
  attachLoginClientCookie,
  BffEdgeRateLimitError,
  BFF_ASSERTION_HEADER,
  bffReplayScopeFor,
  createBffAssertion,
  loginClientFor,
  loginRequestBinding,
  requestBodyDigest,
} from "@/app/api/_lib/bff-assertion";
import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";
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
      { detail: "ENTER_CD, 아이디와 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  let scope;
  try {
    scope = bffReplayScopeFor(request);
  } catch (error) {
    if (error instanceof BffEdgeRateLimitError) {
      return NextResponse.json(
        { detail: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    return NextResponse.json({ detail: "Login service is unavailable." }, { status: 503 });
  }
  const client = loginClientFor(request);
  const backendBody = JSON.stringify({ enter_cd: enterCd, login_id: loginId, password });
  const assertion = createBffAssertion({
    purpose: "login",
    method: "POST",
    path: "/api/v1/auth/login",
    clientId: client.id,
    ...scope,
    requestBinding: loginRequestBinding(enterCd, loginId),
    bodyDigest: requestBodyDigest(backendBody),
  });
  const upstreamResponse = await fetch(`${backendApiBaseUrl()}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [BFF_ASSERTION_HEADER]: assertion,
    },
    cache: "no-store",
    body: backendBody,
  });

  if (!upstreamResponse.ok) {
    const headers = new Headers();
    const contentType = upstreamResponse.headers.get("content-type");
    const retryAfter = upstreamResponse.headers.get("retry-after");
    if (contentType) headers.set("content-type", contentType);
    if (retryAfter) headers.set("retry-after", retryAfter);
    return attachLoginClientCookie(
      new NextResponse(upstreamResponse.body, { status: upstreamResponse.status, headers }),
      client,
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

  return attachLoginClientCookie(response, client);
}
