import { afterEach, expect, test, vi } from "vitest";
import { backendApiBaseUrl } from "./backend-target";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("uses the explicit Spring BFF target", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "http://backend:8080");
  expect(backendApiBaseUrl()).toBe("http://backend:8080");
});

test("does not silently fall back to the retired Python service", () => {
  vi.stubEnv("VIBEHR_BFF_BACKEND_URL", "");
  expect(backendApiBaseUrl).toThrow(/VIBEHR_BFF_BACKEND_URL/);
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
