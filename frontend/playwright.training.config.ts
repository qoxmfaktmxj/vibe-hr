import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  testMatch: "training-applications.spec.ts",
  outputDir: "./test-results/training-applications",
  use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } },
});
