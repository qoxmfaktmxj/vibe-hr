import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type RouteContext = { params: Promise<{ configId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const { configId } = await context.params;
  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/mng/infra-configs/${configId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (upstreamResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await upstreamResponse.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}

