import { NextRequest, NextResponse } from "next/server";

import { backendApiUrl } from "@/app/api/_lib/backend-target";
const AUTH_COOKIE_NAME = "vibe_hr_token";

type Context = { params: Promise<{ groupId: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const { groupId } = await context.params;
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ detail: "Invalid request payload." }, { status: 400 });

  const res = await fetch(`${backendApiUrl("/codes/groups/")}${groupId}`, {
    method: "PUT",
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

export async function DELETE(request: NextRequest, context: Context) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });

  const { groupId } = await context.params;
  const res = await fetch(`${backendApiUrl("/codes/groups/")}${groupId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const data = await res.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: res.status });
}
