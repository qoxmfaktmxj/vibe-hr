import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type RouteContext = { params: Promise<{ caseId: string; itemId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ detail: "Invalid request payload." }, { status: 400 });

  const { caseId, itemId } = await context.params;
  const upstream = await fetch(`${API_BASE_URL}/api/v1/hr/retire/cases/${caseId}/items/${itemId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  const data = await upstream.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstream.status });
}

