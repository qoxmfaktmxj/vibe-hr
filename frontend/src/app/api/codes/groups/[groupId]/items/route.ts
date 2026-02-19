import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type Context = { params: Promise<{ groupId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const { groupId } = await context.params;
  const res = await fetch(`${API_BASE_URL}/api/v1/codes/groups/${groupId}/items`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest, context: Context) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const { groupId } = await context.params;
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ detail: "Invalid request payload." }, { status: 400 });

  const res = await fetch(`${API_BASE_URL}/api/v1/codes/groups/${groupId}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: res.status });
}
