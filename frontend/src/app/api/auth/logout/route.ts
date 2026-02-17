import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "vibe_hr_token";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
