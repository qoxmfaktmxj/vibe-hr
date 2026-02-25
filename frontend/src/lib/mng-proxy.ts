/**
 * MNG 모듈 공통 API 프록시 헬퍼 (server-only).
 * 각 route.ts에서 import하여 사용.
 */
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

function getToken(request: NextRequest): string | null {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

function unauthorized() {
  return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
}

function badRequest(msg = "Invalid request payload.") {
  return NextResponse.json({ detail: msg }, { status: 400 });
}

/** 인증 헤더 포함 upstream 요청 */
async function upstream(
  method: string,
  path: string,
  token: string,
  body?: unknown,
) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const init: RequestInit = { method, headers, cache: "no-store" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, init);
  const data = await res.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: res.status });
}

/** GET 프록시 — searchParams 전달 */
export function proxyGet(backendPath: string) {
  return async (request: NextRequest) => {
    const token = getToken(request);
    if (!token) return unauthorized();

    const qs = request.nextUrl.search; // "?foo=bar&..."
    return upstream("GET", `${backendPath}${qs}`, token);
  };
}

/** POST 프록시 — body 전달 */
export function proxyPost(backendPath: string) {
  return async (request: NextRequest) => {
    const token = getToken(request);
    if (!token) return unauthorized();

    const payload = await request.json().catch(() => null);
    if (!payload) return badRequest();

    return upstream("POST", backendPath, token, payload);
  };
}

/** PUT 프록시 — body.id로 경로 생성 */
export function proxyPut(backendPath: string) {
  return async (request: NextRequest) => {
    const token = getToken(request);
    if (!token) return unauthorized();

    const payload = await request.json().catch(() => null);
    if (!payload) return badRequest();

    const { id, ...rest } = payload;
    return upstream("PUT", `${backendPath}/${id}`, token, rest);
  };
}

/** DELETE 프록시 — body 전달 (bulk delete) */
export function proxyDelete(backendPath: string) {
  return async (request: NextRequest) => {
    const token = getToken(request);
    if (!token) return unauthorized();

    const payload = await request.json().catch(() => null);
    if (!payload) return badRequest();

    return upstream("DELETE", backendPath, token, payload);
  };
}
