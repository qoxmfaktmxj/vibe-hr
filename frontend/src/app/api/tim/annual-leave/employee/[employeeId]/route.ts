import { NextRequest, NextResponse } from "next/server";
import { backendApiUrl } from "@/app/api/_lib/backend-target";

const AUTH_COOKIE_NAME = "vibe_hr_token";

export async function GET(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const { employeeId } = await params;
  const upstream = await fetch(`${backendApiUrl("/tim/annual-leave/employee/")}${employeeId}${request.nextUrl.search}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await upstream.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstream.status });
}
