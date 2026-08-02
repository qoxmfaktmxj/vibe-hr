import { NextRequest, NextResponse } from "next/server";

import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";
const AUTH_COOKIE_NAME = "vibe_hr_token";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const upstreamResponse = await fetch(`${backendApiBaseUrl()}/api/v1/menus/admin/roles`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await upstreamResponse.json().catch(() => ({ detail: "요청 처리 실패" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ detail: "유효하지 않은 요청입니다." }, { status: 400 });
  }

  const upstreamResponse = await fetch(`${backendApiBaseUrl()}/api/v1/menus/admin/roles`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = await upstreamResponse.json().catch(() => ({ detail: "요청 처리 실패" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}
