import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const BFF_ASSERTION_HEADER = "X-VibeHR-BFF-Assertion";
const LOGIN_CLIENT_COOKIE = "vibe_hr_login_client";
const ASSERTION_TTL_SECONDS = 30;
const LOGIN_CLIENT_TTL_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const HEX_256_BIT_PATTERN = /^[0-9a-fA-F]{64}$/u;
const TRUSTED_CLIENT_IP_HEADER = "x-vibehr-client-ip";
const MAX_EDGE_ATTEMPTS_PER_SOURCE = 24;
const EDGE_WINDOW_SECONDS = 60;
const MAX_TRACKED_EDGE_SOURCES = 4_096;
const EDGE_OVERFLOW_SHARDS = 256;

type AssertionInput =
  | {
      purpose: "login";
      method: "POST";
      path: "/api/v1/auth/login";
      clientId: string;
      sourceHash: string;
      replayBucket: number;
      requestBinding: string;
      bodyDigest: string;
    }
  | {
      purpose: "social-exchange";
      method: "POST";
      path: "/api/v1/auth/social/exchange";
      clientId: string;
      sourceHash: string;
      replayBucket: number;
      provider: "google" | "kakao";
      providerUserId: string;
      email: string;
      displayName: string;
      bodyDigest: string;
    };

export type LoginClient = {
  id: string;
  cookieValue: string;
  needsCookie: boolean;
};

export type BffReplayScope = {
  sourceHash: string;
  replayBucket: number;
};

export class BffEdgeRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many authentication requests. Please try again later.");
  }
}

export class BffEdgeRateLimiter {
  private readonly attempts = new Map<string, number[]>();
  private readonly overflowAttempts: number[][];

  constructor(
    private readonly maxTrackedSources = MAX_TRACKED_EDGE_SOURCES,
    private readonly maxAttempts = MAX_EDGE_ATTEMPTS_PER_SOURCE,
    private readonly windowSeconds = EDGE_WINDOW_SECONDS,
    overflowShardCount = EDGE_OVERFLOW_SHARDS,
  ) {
    if (overflowShardCount < 1) throw new Error("BFF edge overflow shard count must be positive.");
    this.overflowAttempts = Array.from({ length: overflowShardCount }, () => []);
  }

  check(sourceHash: string, nowSeconds = Math.floor(Date.now() / 1000)): void {
    this.expire(nowSeconds);
    let history = this.attempts.get(sourceHash);
    if (!history) {
      if (this.evictForNewSource()) {
        history = [];
        this.attempts.set(sourceHash, history);
      } else {
        // Keep active throttled sources intact while containing only the matching SHA-256 shard.
        history = this.overflowAttempts[this.overflowShardFor(sourceHash)];
      }
    } else {
      // Map insertion order is the LRU order after every successful lookup.
      this.attempts.delete(sourceHash);
      this.attempts.set(sourceHash, history);
    }
    if (history.length >= this.maxAttempts) {
      throw new BffEdgeRateLimitError(Math.max(1, this.windowSeconds - (nowSeconds - history[0])));
    }
    history.push(nowSeconds);
  }

  private expire(nowSeconds: number): void {
    for (const [sourceHash, history] of this.attempts) {
      while (history.length > 0 && history[0] <= nowSeconds - this.windowSeconds) history.shift();
      if (history.length === 0) this.attempts.delete(sourceHash);
    }
    for (const history of this.overflowAttempts) {
      while (history.length > 0 && history[0] <= nowSeconds - this.windowSeconds) history.shift();
    }
  }

  private evictForNewSource(): boolean {
    if (this.attempts.size < this.maxTrackedSources) return true;
    for (const [sourceHash, history] of this.attempts) {
      if (history.length < this.maxAttempts) {
        this.attempts.delete(sourceHash);
        return true;
      }
    }
    // Active throttled sources remain protected; new sources use their bounded overflow shard.
    return false;
  }

  private overflowShardFor(sourceHash: string): number {
    const digest = createHash("sha256").update(sourceHash, "utf8").digest();
    return digest.readUInt32BE(0) % this.overflowAttempts.length;
  }
}

const edgeRateLimiter = new BffEdgeRateLimiter();

export function hasValidBffAssertionSecret(secret: string | undefined): secret is string {
  if (!secret || !HEX_256_BIT_PATTERN.test(secret)) return false;
  return !Array.from(secret).every((character) => character === secret[0]);
}

export function hasDistinctBffSecrets(authSecret: string | undefined, bffSecret: string | undefined): boolean {
  return hasValidBffAssertionSecret(authSecret) && hasValidBffAssertionSecret(bffSecret) && authSecret !== bffSecret;
}

function assertionSecret(): string {
  const secret = process.env.VIBEHR_BFF_ASSERTION_SECRET;
  if (!hasValidBffAssertionSecret(secret)) {
    throw new Error("VIBEHR_BFF_ASSERTION_SECRET must be exactly 64 hexadecimal characters and not a repeated-character value.");
  }
  return secret;
}

function trustedClientIp(request: NextRequest): string {
  if (process.env.VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER !== TRUSTED_CLIENT_IP_HEADER) {
    throw new Error("VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER must explicitly be x-vibehr-client-ip.");
  }
  const value = request.headers.get(TRUSTED_CLIENT_IP_HEADER);
  if (!value || value.trim() !== value || value.includes(",") || isIP(value) === 0) {
    throw new Error("The sanitized trusted client IP header is required for BFF authentication.");
  }
  return value;
}

export function bffReplayScopeFor(request: NextRequest): BffReplayScope {
  const sourceHash = createHash("sha256").update(trustedClientIp(request), "utf8").digest("base64url");
  edgeRateLimiter.check(sourceHash);
  return { sourceHash, replayBucket: Buffer.from(sourceHash, "base64url")[0] };
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function clientCookieValue(clientId: string): string {
  return `${clientId}.${hmac(assertionSecret(), `vibehr-login-client-v1.${clientId}`)}`;
}

function parseLoginClient(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2 || !TOKEN_PATTERN.test(parts[0]) || parts[0].length !== 43 || !TOKEN_PATTERN.test(parts[1])) {
    return null;
  }
  return constantTimeEqual(parts[1], hmac(assertionSecret(), `vibehr-login-client-v1.${parts[0]}`)) ? parts[0] : null;
}

export function loginClientFor(request: NextRequest): LoginClient {
  const existing = parseLoginClient(request.cookies.get(LOGIN_CLIENT_COOKIE)?.value);
  if (existing) {
    return { id: existing, cookieValue: clientCookieValue(existing), needsCookie: false };
  }
  const id = randomBytes(32).toString("base64url");
  return { id, cookieValue: clientCookieValue(id), needsCookie: true };
}

export function attachLoginClientCookie(response: NextResponse, client: LoginClient): NextResponse {
  if (client.needsCookie) {
    response.cookies.set({
      name: LOGIN_CLIENT_COOKIE,
      value: client.cookieValue,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LOGIN_CLIENT_TTL_SECONDS,
    });
  }
  return response;
}

export function loginRequestBinding(enterCd: string, loginId: string): string {
  return createHash("sha256")
    .update(`${enterCd.trim().toUpperCase()}\u0000${loginId.trim()}`, "utf8")
    .digest("base64url");
}

export function requestBodyDigest(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("base64url");
}

export function createBffAssertion(input: AssertionInput, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const secret = assertionSecret();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "VIBEHR-BFF" }), "utf8").toString("base64url");
  const common = {
    ver: 1,
    method: input.method,
    path: input.path,
    iat: nowSeconds,
    exp: nowSeconds + ASSERTION_TTL_SECONDS,
    nonce: randomBytes(32).toString("base64url"),
    purpose: input.purpose,
    body_sha256: input.bodyDigest,
    source_hash: input.sourceHash,
    replay_bucket: input.replayBucket,
  };
  const payload = input.purpose === "login"
    ? { ...common, client_id: input.clientId, request_binding: input.requestBinding }
    : {
        ...common,
        client_id: input.clientId,
        provider: input.provider,
        provider_user_id: input.providerUserId,
        email: input.email,
        display_name: input.displayName,
        // This claim is only emitted after the provider-specific callback checks pass.
        email_verified: true,
      };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signingInput = `${header}.${encodedPayload}`;
  return `${signingInput}.${hmac(secret, signingInput)}`;
}
