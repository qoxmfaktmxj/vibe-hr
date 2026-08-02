import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";
import { forwardBackendResponse } from "@/app/api/_lib/forward-backend-response";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type UpstreamMethod = "GET" | "POST" | "PUT" | "DELETE";

function getToken(request: NextRequest): string | null {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

function unauthorized() {
  return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
}

function badRequest(msg = "Invalid request payload.") {
  return NextResponse.json({ detail: msg }, { status: 400 });
}

async function upstream(method: UpstreamMethod, path: string, token: string, body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const init: RequestInit = { method, headers, cache: "no-store" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${backendApiBaseUrl()}${path}`, init);
  return forwardBackendResponse(response);
}

export function proxyGet(backendPath: string) {
  return async (request: NextRequest) => {
    const token = getToken(request);
    if (!token) return unauthorized();

    return upstream("GET", `${backendPath}${request.nextUrl.search}`, token);
  };
}

export function proxyPost(backendPath: string) {
  return async (request: NextRequest) => {
    const token = getToken(request);
    if (!token) return unauthorized();

    const payload = await request.json().catch(() => null);
    if (!payload) return badRequest();

    return upstream("POST", backendPath, token, payload);
  };
}

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

export function proxyDelete(backendPath: string) {
  return async (request: NextRequest) => {
    const token = getToken(request);
    if (!token) return unauthorized();

    const payload = await request.json().catch(() => null);
    if (!payload) return badRequest();

    return upstream("DELETE", backendPath, token, payload);
  };
}
