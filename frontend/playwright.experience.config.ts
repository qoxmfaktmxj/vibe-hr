import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

// Isolated synthetic UI fixtures. This does not verify production backend or auth security.
const frontendOrigin = "http://127.0.0.1:3100";
const backendOrigin = "http://127.0.0.1:3101";
const runtimeEnv = {
  AUTH_TOKEN_SECRET: randomBytes(32).toString("hex"),
  VIBEHR_BFF_ASSERTION_SECRET: randomBytes(32).toString("hex"),
  VIBEHR_BFF_BACKEND_URL: backendOrigin,
  VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER: "x-vibehr-client-ip",
  APP_ORIGIN: frontendOrigin,
  NEXT_PUBLIC_APP_ORIGIN: frontendOrigin,
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "employee-experience.spec.ts",
  outputDir: "./test-results/employee-experience",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: frontendOrigin,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { "x-vibehr-client-ip": "127.0.0.1" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/employee-experience-backend.mjs",
      url: `${backendOrigin}/health`,
      env: runtimeEnv,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
      url: `${frontendOrigin}/login`,
      env: runtimeEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
