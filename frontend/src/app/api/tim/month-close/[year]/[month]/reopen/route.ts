import { NextRequest, NextResponse } from "next/server";

import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";
const AUTH_COOKIE_NAME = "vibe_hr_token";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> },
) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const { year, month } = await params;

  const upstream = await fetch(`${backendApiBaseUrl()}/api/v1/tim/month-close/${year}/${month}/reopen`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });

  const data = await upstream.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstream.status });
}
