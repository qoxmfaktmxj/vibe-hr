import { NextRequest, NextResponse } from "next/server";

import type { AuthUser } from "@/types/auth";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const AUTH_COOKIE_NAME = "vibe_hr_token";

type MeResponse = AuthUser;

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!upstreamResponse.ok) {
    const response = NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const user = (await upstreamResponse.json()) as MeResponse;
  return NextResponse.json({ user }, { status: 200 });
}
