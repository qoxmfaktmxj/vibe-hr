import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "vibe_hr_token";
const ACCESS_TTL_COOKIE = "vibe_hr_access_ttl_min";
const REFRESH_THRESHOLD_COOKIE = "vibe_hr_refresh_threshold_min";
const SHOW_COUNTDOWN_COOKIE = "vibe_hr_show_countdown";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  for (const cookieName of [AUTH_COOKIE_NAME, ACCESS_TTL_COOKIE, REFRESH_THRESHOLD_COOKIE, SHOW_COUNTDOWN_COOKIE]) {
    response.cookies.set({
      name: cookieName,
      value: "",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
