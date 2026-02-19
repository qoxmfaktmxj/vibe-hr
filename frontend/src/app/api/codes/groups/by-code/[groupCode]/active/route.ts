import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type Context = { params: Promise<{ groupCode: string }> };

export async function GET(request: NextRequest, context: Context) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const { groupCode } = await context.params;
  const res = await fetch(`${API_BASE_URL}/api/v1/codes/groups/by-code/${groupCode}/active`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: res.status });
}
