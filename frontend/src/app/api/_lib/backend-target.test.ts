import { afterEach, expect, test, vi } from "vitest";
import { backendApiBaseUrl, backendApiPath, backendApiUrl } from "./backend-target";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("uses the explicit Spring BFF target", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  expect(backendApiBaseUrl()).toBe("http://backend:8080");
});

test("builds backend API v1 URLs from versionless paths", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  expect(backendApiPath("/org/chart")).toBe("/api/v1/org/chart");
  expect(backendApiUrl("/org/chart")).toBe("http://backend:8080/api/v1/org/chart");
});

test("does not silently fall back to the retired Python service", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "");
  expect(backendApiBaseUrl).toThrow(/VIBEHR_BFF_BACKEND_URL/);
});

test("rejects malformed backend paths", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  expect(() => backendApiUrl("openapi.json")).toThrow(/single slash/);
  expect(() => backendApiUrl("/api/v1/org/chart")).toThrow(/versionless/);
});

test.each([
  "ftp://backend:8080",
  "https://user:password@backend:8080",
  "https://backend:8080/",
  "https://backend:8080/.",
  "https://backend:8080/api/v1",
  "https://backend:8080?",
  "https://backend:8080?target=external",
  "https://backend:8080#",
  "https://backend:8080#external",
  " https://backend:8080",
])("rejects unsafe BFF target %s", (target) => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", target);
  expect(backendApiBaseUrl).toThrow(/VIBEHR_BFF_BACKEND_URL/);
});
