import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "vibe_hr_token";
const ENTER_CD_COOKIE = "vibe_hr_enter_cd";
const ACCESS_TTL_COOKIE = "vibe_hr_access_ttl_min";
const REFRESH_THRESHOLD_COOKIE = "vibe_hr_refresh_threshold_min";
const SHOW_COUNTDOWN_COOKIE = "vibe_hr_show_countdown";
const REMEMBER_ENABLED_COOKIE = "vibe_hr_remember_enabled";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  for (const cookieName of [AUTH_COOKIE_NAME, ENTER_CD_COOKIE, ACCESS_TTL_COOKIE, REFRESH_THRESHOLD_COOKIE, SHOW_COUNTDOWN_COOKIE, REMEMBER_ENABLED_COOKIE]) {
    response.cookies.set({
      name: cookieName,
      value: "",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
