import { defineConfig } from "@playwright/test";
import landing from "./playwright.landing.config";

export default defineConfig({ ...landing, testMatch: "water-preview-capture.spec.ts", outputDir: "./test-results/water-preview-capture", timeout: 120_000 });
