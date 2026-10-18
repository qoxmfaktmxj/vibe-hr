import { defineConfig } from "@playwright/test";
import landing from "./playwright.landing.config";

export default defineConfig({ ...landing, testMatch: "product-motion.spec.ts", outputDir: "./test-results/product-motion", timeout: 120_000 });
