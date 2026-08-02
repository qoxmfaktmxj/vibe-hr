import { afterEach, expect, test, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";

import { requestBodyDigest } from "@/app/api/_lib/bff-assertion";
import { POST } from "./route";

const TEST_BFF_ASSERTION_SECRET = randomBytes(32).toString("hex");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("forwards a BFF-bound login assertion and preserves Spring 429 details", async () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  vi.stubEnv("VIBEHR_BFF_ASSERTION_SECRET", TEST_BFF_ASSERTION_SECRET);
  vi.stubEnv("VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER", "x-vibehr-client-ip");
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ detail: "Too many login attempts. Please try again later." }),
    { status: 429, headers: { "content-type": "application/json", "retry-after": "42" } },
  ));
  vi.stubGlobal("fetch", fetchMock);

  const response = await POST(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ enter_cd: "vibe", login_id: "admin", password: "password" }),
    headers: { "x-vibehr-client-ip": "203.0.113.8" },
  }));

  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("42");
  expect(await response.json()).toEqual({ detail: "Too many login attempts. Please try again later." });
  expect(response.headers.get("set-cookie")).toContain("vibe_hr_login_client=");

  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const assertion = (init.headers as Record<string, string>)["X-VibeHR-BFF-Assertion"];
  const payload = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"));
  expect(payload).toMatchObject({
    purpose: "login",
    method: "POST",
    path: "/api/v1/auth/login",
    request_binding: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    body_sha256: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    source_hash: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    replay_bucket: expect.any(Number),
  });
  expect(payload.client_id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(payload.body_sha256).toBe(requestBodyDigest(
    JSON.stringify({ enter_cd: "VIBE", login_id: "admin", password: "password" }),
  ));
});

test("fails closed before signing when the reverse proxy client IP invariant is absent", async () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  vi.stubEnv("VIBEHR_BFF_ASSERTION_SECRET", TEST_BFF_ASSERTION_SECRET);
  vi.stubEnv("VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER", "x-vibehr-client-ip");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const response = await POST(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ enter_cd: "vibe", login_id: "admin", password: "password" }),
    headers: { "x-forwarded-for": "203.0.113.8" },
  }));

  expect(response.status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
});
