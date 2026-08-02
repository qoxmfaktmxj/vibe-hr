import { afterEach, expect, test, vi } from "vitest";
import { InvalidCatchallPathError, safeCatchallUrl } from "./safe-catchall-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("keeps a catch-all request inside its fixed API domain", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "https://backend.internal:8443");
  const target = safeCatchallUrl("pay", ["runs", "42", "payslip"], "?download=1");

  expect(target.toString()).toBe("https://backend.internal:8443/api/v1/pay/runs/42/payslip?download=1");
});

test.each([
  ["."],
  [".."],
  ["%2e%2e"],
  ["%252e%252e"],
  ["%2Fauth%2Fme"],
  ["%252Fauth"],
  ["%5Cauth"],
  ["%255Cauth"],
  ["%252525252e%252525252e"],
  ["%25252525252e%25252525252e"],
  ["reports/secret"],
  ["reports\\secret"],
])("rejects traversal-shaped catch-all segment %s", (segment) => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  expect(() => safeCatchallUrl("tra", [segment], "")).toThrow(InvalidCatchallPathError);
});

test("encodes reserved characters rather than changing the upstream path", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  const target = safeCatchallUrl("pap", ["final result"], "");
  expect(target.pathname).toBe("/api/v1/pap/final%20result");
});

test("accepts an ordinarily encoded segment after repeated decoding", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  const target = safeCatchallUrl("pay", ["bonus%2520plan"], "");
  expect(target.pathname).toBe("/api/v1/pay/bonus%20plan");
});
