import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  testMatch: ["employee-ux.spec.ts", "hri-tasks.spec.ts", "common-design.spec.ts"],
  outputDir: "./test-results/common-design",
  use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } },
});
