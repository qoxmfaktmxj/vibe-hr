import { NextRequest, NextResponse } from "next/server";

import type { AuthUser } from "@/types/auth";

type Provider = "google" | "kakao";

type BackendLoginResponse = {
  access_token: string;
  user: AuthUser;
};

type GoogleProfile = {
  id?: string | number;
  email?: string;
  name?: string;
};

type KakaoProfile = {
  id?: string | number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
};

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const AUTH_COOKIE_NAME = "vibe_hr_token";
const APP_ORIGIN =
  process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? "";
const tokenExpiresEnv = Number(process.env.AUTH_TOKEN_EXPIRES_MIN ?? "480");
const AUTH_TOKEN_EXPIRES_MIN =
  Number.isFinite(tokenExpiresEnv) && tokenExpiresEnv > 0 ? tokenExpiresEnv : 480;
const AUTH_COOKIE_MAX_AGE_SECONDS = Math.max(60, AUTH_TOKEN_EXPIRES_MIN * 60);

function getConfig(provider: Provider) {
  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
      tokenUrl: "https://oauth2.googleapis.com/token",
      profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    };
  }

  return {
    clientId: process.env.KAKAO_CLIENT_ID ?? "",
    clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    redirectUri: process.env.KAKAO_REDIRECT_URI ?? "",
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    profileUrl: "https://kapi.kakao.com/v2/user/me",
  };
}

function resolveAppOrigin(request: NextRequest): string {
  if (APP_ORIGIN) return APP_ORIGIN;
  const xfHost = request.headers.get("x-forwarded-host");
  if (xfHost) {
    const xfProto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${xfProto}://${xfHost}`;
  }
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.nextUrl.protocol.replace(":", "") || "https";
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const appOrigin = resolveAppOrigin(request);
  const { provider: raw } = await context.params;
  if (raw !== "google" && raw !== "kakao") {
    return NextResponse.redirect(new URL("/login?error=unsupported_provider", appOrigin));
  }

  const provider = raw as Provider;
  const cfg = getConfig(provider);
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const err = url.searchParams.get("error");

  if (err) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err)}`, appOrigin));
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", appOrigin));

  const stateCookie = request.cookies.get(`vibe_hr_oauth_state_${provider}`)?.value;
  if (!stateCookie || !state || stateCookie !== state) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", appOrigin));
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      code,
    });

    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
      cache: "no-store",
    });
    const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
    const accessToken = tokenJson?.access_token;
    if (!tokenRes.ok || !accessToken) {
      return NextResponse.redirect(new URL("/login?error=token_exchange_failed", appOrigin));
    }

    const profileRes = await fetch(cfg.profileUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const profile = (await profileRes.json().catch(() => null)) as GoogleProfile | KakaoProfile | null;
    if (!profileRes.ok || !profile) {
      return NextResponse.redirect(new URL("/login?error=profile_fetch_failed", appOrigin));
    }

    const normalized =
      provider === "google"
        ? {
            provider_user_id: String(profile.id ?? ""),
            email: String(profile.email ?? "").trim().toLowerCase(),
            display_name: String(profile.name ?? profile.email ?? "Google User"),
          }
        : {
            provider_user_id: String(profile.id ?? ""),
            email: String(profile?.kakao_account?.email ?? "").trim().toLowerCase(),
            display_name: String(profile?.kakao_account?.profile?.nickname ?? "Kakao User"),
          };

    if (!normalized.provider_user_id) {
      return NextResponse.redirect(new URL("/login?error=missing_profile_fields", appOrigin));
    }

    if (!normalized.email) {
      return NextResponse.redirect(new URL("/login?error=email_required", appOrigin));
    }

    const backendRes = await fetch(`${API_BASE_URL}/api/v1/auth/social/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        provider,
        provider_user_id: normalized.provider_user_id,
        email: normalized.email,
        display_name: normalized.display_name,
      }),
    });

    const backendJson = (await backendRes.json().catch(() => null)) as BackendLoginResponse | null;
    if (!backendRes.ok || !backendJson?.access_token) {
      return NextResponse.redirect(new URL("/login?error=social_exchange_failed", appOrigin));
    }

    const response = NextResponse.redirect(new URL("/dashboard", appOrigin));
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: backendJson.access_token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    });
    response.cookies.set({
      name: `vibe_hr_oauth_state_${provider}`,
      value: "",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=unexpected", appOrigin));
  }
}
