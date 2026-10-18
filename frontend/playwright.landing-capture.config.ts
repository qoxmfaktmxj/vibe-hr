import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  testMatch: "landing-capture.spec.ts",
  outputDir: "./test-results/landing-capture",
  use: { ...experience.use, viewport: { width: 1600, height: 1080 }, contextOptions: { reducedMotion: "reduce" } },
});
