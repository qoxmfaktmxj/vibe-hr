import { NextRequest, NextResponse } from "next/server";

import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const { requestId } = await context.params;
  const upstream = await fetch(`${backendApiBaseUrl()}/api/v1/tim/leave-requests/${requestId}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = await upstream.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstream.status });
}
