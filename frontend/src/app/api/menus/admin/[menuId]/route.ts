import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type Params = { params: { menuId: string } };

export async function PUT(request: NextRequest, { params }: Params) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const { menuId } = params;
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ detail: "유효하지 않은 요청입니다." }, { status: 400 });
  }

  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/menus/admin/${menuId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = await upstreamResponse.json().catch(() => ({ detail: "요청 처리 실패" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const { menuId } = params;

  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/menus/admin/${menuId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (upstreamResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await upstreamResponse.json().catch(() => ({ detail: "요청 처리 실패" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}
