import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  testMatch: "product-landing.spec.ts",
  outputDir: "./test-results/product-landing",
  timeout: 90_000,
  use: {
    ...experience.use,
    launchOptions: process.env.PLAYWRIGHT_HARDWARE_GPU !== "0" && process.platform === "win32"
      ? { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] }
      : undefined,
  },
});
