import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const search = request.nextUrl.search || "";
  const upstream = await fetch(`${API_BASE_URL}/api/v1/tim/attendance-daily${search}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await upstream.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstream.status });
}
