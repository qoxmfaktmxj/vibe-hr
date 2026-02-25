import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const { requestId } = await context.params;
  const payload = (await request.json().catch(() => null)) ?? { comment: null };

  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/hri/requests/${requestId}/reject`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = await upstreamResponse.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}
