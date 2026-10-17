import { defineConfig } from "@playwright/test";
import live from "./playwright.config";

export default defineConfig({
  ...live,
  testMatch: "financial-finalization.spec.ts",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  outputDir: "./test-results/financial-finalization",
  use: { ...live.use, viewport: { width: 1440, height: 1000 } },
});
