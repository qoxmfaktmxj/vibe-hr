import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  testMatch: "retirement-selection.spec.ts",
  outputDir: "./test-results/retirement-selection",
  use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } },
});
