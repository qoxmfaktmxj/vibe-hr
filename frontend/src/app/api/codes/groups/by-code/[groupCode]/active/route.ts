import { NextRequest, NextResponse } from "next/server";

import { backendApiUrl } from "@/app/api/_lib/backend-target";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type Context = { params: Promise<{ groupCode: string }> };

export async function GET(request: NextRequest, context: Context) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const { groupCode } = await context.params;
  const res = await fetch(`${backendApiUrl("/codes/groups/by-code/")}${groupCode}/active`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: res.status });
}
