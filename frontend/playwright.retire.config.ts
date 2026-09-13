import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";
export default defineConfig({ ...experience, testMatch: "retire-layout.spec.ts", outputDir: "./test-results/retire-layout", use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } } });
