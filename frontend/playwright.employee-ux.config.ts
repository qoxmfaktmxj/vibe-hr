import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";
export default defineConfig({ ...experience, testMatch: "employee-ux.spec.ts", outputDir: "./test-results/employee-ux", use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } } });
