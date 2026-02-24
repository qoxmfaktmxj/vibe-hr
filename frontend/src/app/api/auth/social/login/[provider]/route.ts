import { NextRequest, NextResponse } from "next/server";

type Provider = "google" | "kakao";

function getConfig(provider: Provider) {
  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scope: "openid email profile",
      extra: { access_type: "offline", prompt: "consent" },
    };
  }

  return {
    clientId: process.env.KAKAO_CLIENT_ID ?? "",
    redirectUri: process.env.KAKAO_REDIRECT_URI ?? "",
    authUrl: "https://kauth.kakao.com/oauth/authorize",
    scope: "profile_nickname account_email",
    extra: {},
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await context.params;
  if (raw !== "google" && raw !== "kakao") {
    return NextResponse.json({ detail: "Unsupported provider." }, { status: 400 });
  }

  const provider = raw as Provider;
  const cfg = getConfig(provider);
  if (!cfg.clientId || !cfg.redirectUri) {
    return NextResponse.json({ detail: `${provider.toUpperCase()} OAuth 설정이 없습니다.` }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const url = new URL(cfg.authUrl);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", state);

  Object.entries(cfg.extra).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = NextResponse.redirect(url.toString());
  response.cookies.set({
    name: `vibe_hr_oauth_state_${provider}`,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
