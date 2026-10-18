import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({ ...experience, testMatch: "grid-rollout.spec.ts", outputDir: "./test-results/grid-rollout", use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } } });
