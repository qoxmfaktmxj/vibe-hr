import { NextRequest, NextResponse } from "next/server";

import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";
const AUTH_COOKIE_NAME = "vibe_hr_token";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const search = request.nextUrl.search || "";
  const upstreamResponse = await fetch(`${backendApiBaseUrl()}/api/v1/wel/benefit-types${search}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await upstreamResponse.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const body = await request.text();
  const upstreamResponse = await fetch(`${backendApiBaseUrl()}/api/v1/wel/benefit-types/batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });
  const data = await upstreamResponse.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}
