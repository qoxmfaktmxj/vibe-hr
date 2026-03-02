import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "vibe_hr_token";
const SHOW_COUNTDOWN_COOKIE = "vibe_hr_show_countdown";

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ authenticated: false, remaining_sec: 0 }, { status: 200 });

  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  const now = Math.floor(Date.now() / 1000);
  const remaining = typeof exp === "number" ? Math.max(0, exp - now) : 0;
  const show = request.cookies.get(SHOW_COUNTDOWN_COOKIE)?.value !== "0";

  return NextResponse.json(
    { authenticated: true, remaining_sec: remaining, show_countdown: show },
    { status: 200 },
  );
}
