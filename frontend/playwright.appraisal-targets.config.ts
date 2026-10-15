import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  testMatch: "appraisal-targets.spec.ts",
  outputDir: "./test-results/appraisal-targets",
  use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } },
});
