import { createHash, randomBytes } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  BffEdgeRateLimiter,
  BffEdgeRateLimitError,
  bffReplayScopeFor,
  createBffAssertion,
  hasDistinctBffSecrets,
  hasValidBffAssertionSecret,
  requestBodyDigest,
} from "./bff-assertion";

afterEach(() => vi.unstubAllEnvs());

const AUTH_SECRET = randomBytes(32).toString("hex");
const BFF_SECRET = randomBytes(32).toString("hex");

test("accepts only distinct 256-bit hexadecimal BFF secrets", () => {
  expect(hasValidBffAssertionSecret(undefined)).toBe(false);
  expect(hasValidBffAssertionSecret("  valid-secret-that-is-long-enough-to-pass  ")).toBe(false);
  expect(hasValidBffAssertionSecret("valid-secret-that-is-long-enough\tto-pass")).toBe(false);
  expect(hasValidBffAssertionSecret("valid-secret-with-a-bom\uFEFF-at-the-end")).toBe(false);
  expect(hasValidBffAssertionSecret("valid-secret-with-a-control\u0001-at-the-end")).toBe(false);
  expect(hasValidBffAssertionSecret("valid-secret-with-a-format\u200B-at-the-end")).toBe(false);
  expect(hasValidBffAssertionSecret("too-short")).toBe(false);
  expect(hasValidBffAssertionSecret("replace-me-with-a-secret-that-is-long-enough")).toBe(false);
  expect(hasValidBffAssertionSecret("replace-with-a-secret-that-is-long-enough")).toBe(false);
  expect(hasValidBffAssertionSecret("a".repeat(64))).toBe(false);
  expect(hasValidBffAssertionSecret("passwordpasswordpasswordpasswordpasswordpasswordpasswordpassword")).toBe(false);
  expect(hasValidBffAssertionSecret(AUTH_SECRET.slice(0, -1))).toBe(false);
  expect(hasValidBffAssertionSecret(BFF_SECRET)).toBe(true);
  expect(hasDistinctBffSecrets(AUTH_SECRET, BFF_SECRET)).toBe(true);
  expect(hasDistinctBffSecrets(AUTH_SECRET, AUTH_SECRET)).toBe(false);
});

test("signs the exact UTF-8 request body digest", () => {
  vi.stubEnv("VIBEHR_BFF_ASSERTION_SECRET", BFF_SECRET);
  const body = '{"enter_cd":"VIBE","login_id":"admin","password":"password"}';
  const assertion = createBffAssertion({
    purpose: "login",
    method: "POST",
    path: "/api/v1/auth/login",
    clientId: "a".repeat(43),
    sourceHash: "b".repeat(43),
    replayBucket: 17,
    requestBinding: "b".repeat(43),
    bodyDigest: requestBodyDigest(body),
  });
  const payload = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"));

  expect(payload.body_sha256).toBe(requestBodyDigest(body));
  expect(payload.body_sha256).not.toBe(requestBodyDigest(`${body} `));
});

test("uses only the explicitly configured sanitized client IP header for a stable replay source", () => {
  vi.stubEnv("VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER", "x-vibehr-client-ip");
  const first = bffReplayScopeFor(new NextRequest("http://localhost/api/auth/login", {
    headers: { "x-vibehr-client-ip": "203.0.113.8", "x-forwarded-for": "attacker.invalid" },
  }));
  const second = bffReplayScopeFor(new NextRequest("http://localhost/api/auth/login", {
    headers: { "x-vibehr-client-ip": "203.0.113.8", "forwarded": "for=attacker.invalid" },
  }));

  expect(first).toEqual(second);
  expect(first.sourceHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(first.replayBucket).toBeGreaterThanOrEqual(0);
  expect(first.replayBucket).toBeLessThan(256);
  expect(() => bffReplayScopeFor(new NextRequest("http://localhost/api/auth/login"))).toThrow(/trusted client IP/i);
  vi.stubEnv("VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER", "x-forwarded-for");
  expect(() => bffReplayScopeFor(new NextRequest("http://localhost/api/auth/login", {
    headers: { "x-forwarded-for": "203.0.113.8" },
  }))).toThrow(/must explicitly be x-vibehr-client-ip/i);
});

test("saturated edge tracking bounds one SHA-256 overflow shard without blocking another shard", () => {
  const shardCount = 2;
  const limiter = new BffEdgeRateLimiter(2, 2, 60, shardCount);
  const protectedOne = keyForShard(0, shardCount, "protected-one");
  const protectedTwo = keyForShard(0, shardCount, "protected-two");
  const sameShardOne = keyForShard(0, shardCount, "rotating-one");
  const sameShardTwo = keyForShard(0, shardCount, "rotating-two");
  const blockedSameShard = keyForShard(0, shardCount, "blocked");
  const otherShard = keyForShard(1, shardCount, "unrelated");

  limiter.check(protectedOne, 100);
  limiter.check(protectedOne, 100);
  limiter.check(protectedTwo, 100);
  limiter.check(protectedTwo, 100);

  limiter.check(sameShardOne, 100);
  limiter.check(sameShardTwo, 100);
  let rejection: unknown;
  try {
    limiter.check(blockedSameShard, 130);
  } catch (error) {
    rejection = error;
  }
  expect(rejection).toBeInstanceOf(BffEdgeRateLimitError);
  expect((rejection as BffEdgeRateLimitError).retryAfterSeconds).toBe(30);
  expect(() => limiter.check(otherShard, 130)).not.toThrow();
  expect(() => limiter.check(protectedOne, 130)).toThrow(BffEdgeRateLimitError);
  expect(() => limiter.check(protectedTwo, 130)).toThrow(BffEdgeRateLimitError);
  expect(() => limiter.check(keyForShard(0, shardCount, "recovered"), 160)).not.toThrow();
});

function keyForShard(shard: number, shardCount: number, prefix: string): string {
  for (let suffix = 0; suffix < 10_000; suffix++) {
    const key = `${prefix}-${suffix}`;
    const digest = createHash("sha256").update(key, "utf8").digest();
    if (digest.readUInt32BE(0) % shardCount === shard) return key;
  }
  throw new Error(`No key found for shard ${shard}.`);
}
