import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";
export default defineConfig({ ...experience, testMatch: "checklist-layout.spec.ts", outputDir: "./test-results/checklist-layout", use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } } });
