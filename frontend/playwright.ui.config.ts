import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  grep: /@ui-smoke/,
  outputDir: "./test-results/ui-smoke",
  use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } },
});
