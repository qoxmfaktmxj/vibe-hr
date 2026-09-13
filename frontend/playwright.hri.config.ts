import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";
export default defineConfig({ ...experience, testMatch: "hri-tasks.spec.ts", outputDir: "./test-results/hri-tasks", use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } } });
