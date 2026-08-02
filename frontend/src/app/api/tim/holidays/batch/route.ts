import { NextRequest, NextResponse } from "next/server";

import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";
const AUTH_COOKIE_NAME = "vibe_hr_token";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ detail: "Invalid request payload." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") ?? new Date().getFullYear().toString();

  const upstreamResponse = await fetch(
    `${backendApiBaseUrl()}/api/v1/tim/holidays/batch?year=${year}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(payload),
    },
  );

  const data = await upstreamResponse.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}
