import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const resolvedParams = await params;
  const path = resolvedParams.path.join("/");
  const targetUrl = new URL(`${API_BASE_URL}/api/v1/tra/${path}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  const reqContentType = request.headers.get("content-type");
  if (reqContentType) {
    headers.set("Content-Type", reqContentType);
  }

  const options: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const bodyText = await request.text();
    if (bodyText) {
      options.body = bodyText;
    }
  }

  try {
    const upstream = await fetch(targetUrl.toString(), options);
    const contentType = upstream.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const data = await upstream.json().catch(() => ({ detail: "Request failed" }));
      return NextResponse.json(data, { status: upstream.status });
    }

    const text = await upstream.text();
    return NextResponse.json({ detail: text }, { status: upstream.status });
  } catch (error) {
    console.error("TRA proxy error:", error);
    return NextResponse.json({ detail: "Failed to fetch from backend API" }, { status: 502 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
