import { afterEach, expect, test, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";

import { GET } from "./route";

const TEST_BFF_ASSERTION_SECRET = randomBytes(32).toString("hex");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configureGoogle() {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  vi.stubEnv("VIBEHR_BFF_ASSERTION_SECRET", TEST_BFF_ASSERTION_SECRET);
  vi.stubEnv("VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER", "x-vibehr-client-ip");
  vi.stubEnv("APP_ORIGIN", "http://localhost");
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "http://localhost/api/auth/social/callback/google");
}

test("signs only Google profiles whose provider email is verified", async () => {
  configureGoogle();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "provider-token" }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: "google-subject",
      email: "person@example.com",
      name: "Person",
      verified_email: true,
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: "vibe-token",
      user: { id: 1, email: "person@example.com", display_name: "Person", roles: ["employee"] },
    }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await GET(new NextRequest(
    "http://localhost/api/auth/social/callback/google?code=code-1&state=state-1",
    { headers: { cookie: "vibe_hr_oauth_state_google=state-1", "x-vibehr-client-ip": "203.0.113.8" } },
  ), { params: Promise.resolve({ provider: "google" }) });

  expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  const [, init] = fetchMock.mock.calls[2] as [string, RequestInit];
  const assertion = (init.headers as Record<string, string>)["X-VibeHR-BFF-Assertion"];
  const payload = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"));
  expect(payload).toMatchObject({
    purpose: "social-exchange",
    provider: "google",
    provider_user_id: "google-subject",
    email: "person@example.com",
    display_name: "Person",
    email_verified: true,
    client_id: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    body_sha256: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    source_hash: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    replay_bucket: expect.any(Number),
    method: "POST",
    path: "/api/v1/auth/social/exchange",
  });
});

test("fails closed when APP_ORIGIN is absent, malformed, or influenced by forwarded headers", async () => {
  configureGoogle();
  vi.stubEnv("APP_ORIGIN", "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const missing = await GET(new NextRequest(
    "http://attacker.invalid/api/auth/social/callback/google?code=code&state=state",
    { headers: { "x-forwarded-host": "attacker.invalid", cookie: "vibe_hr_oauth_state_google=state" } },
  ), { params: Promise.resolve({ provider: "google" }) });
  expect(missing.status).toBe(500);
  expect(fetchMock).not.toHaveBeenCalled();

  vi.stubEnv("APP_ORIGIN", "https://trusted.example/path");
  const malformed = await GET(new NextRequest(
    "http://attacker.invalid/api/auth/social/callback/google?code=code&state=state",
    { headers: { "x-forwarded-host": "attacker.invalid", cookie: "vibe_hr_oauth_state_google=state" } },
  ), { params: Promise.resolve({ provider: "google" }) });
  expect(malformed.status).toBe(500);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("rejects Google and Kakao profiles without provider-verified email before the Spring exchange", async () => {
  configureGoogle();
  const googleFetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "provider-token" }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: "google-subject",
      email: "person@example.com",
      verified_email: false,
    }), { status: 200 }));
  vi.stubGlobal("fetch", googleFetch);

  const googleResponse = await GET(new NextRequest(
    "http://localhost/api/auth/social/callback/google?code=code-2&state=state-2",
    { headers: { cookie: "vibe_hr_oauth_state_google=state-2" } },
  ), { params: Promise.resolve({ provider: "google" }) });
  expect(googleResponse.headers.get("location")).toBe("http://localhost/login?error=email_unverified");
  expect(googleFetch).toHaveBeenCalledTimes(2);

  vi.stubEnv("KAKAO_CLIENT_ID", "kakao-client");
  vi.stubEnv("KAKAO_CLIENT_SECRET", "kakao-secret");
  vi.stubEnv("KAKAO_REDIRECT_URI", "http://localhost/api/auth/social/callback/kakao");
  const kakaoFetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "provider-token" }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: "kakao-subject",
      kakao_account: {
        email: "person@example.com",
        is_email_valid: true,
        is_email_verified: false,
        profile: { nickname: "Person" },
      },
    }), { status: 200 }));
  vi.stubGlobal("fetch", kakaoFetch);

  const kakaoResponse = await GET(new NextRequest(
    "http://localhost/api/auth/social/callback/kakao?code=code-3&state=state-3",
    { headers: { cookie: "vibe_hr_oauth_state_kakao=state-3" } },
  ), { params: Promise.resolve({ provider: "kakao" }) });
  expect(kakaoResponse.headers.get("location")).toBe("http://localhost/login?error=email_unverified");
  expect(kakaoFetch).toHaveBeenCalledTimes(2);
});
