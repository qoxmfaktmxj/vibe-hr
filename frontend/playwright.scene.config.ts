import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

export default defineConfig({
  ...experience,
  testMatch: "scene-fidelity.spec.ts",
  outputDir: "./test-results/scene-fidelity",
  use: {
    ...experience.use,
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PLAYWRIGHT_HARDWARE_GPU === "1" && process.platform === "win32"
      ? { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] }
      : undefined,
  },
});
