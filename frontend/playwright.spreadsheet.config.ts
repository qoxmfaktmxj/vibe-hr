import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  testMatch: "spreadsheet-actions.spec.ts",
  outputDir: "./test-results/spreadsheet-actions",
  use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } },
});
