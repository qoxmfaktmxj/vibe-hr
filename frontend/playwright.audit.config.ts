import { defineConfig } from "@playwright/test";
import experience from "./playwright.experience.config";

const servers = Array.isArray(experience.webServer) ? experience.webServer : [];

// Reuse one completed production build for all affected workflows and smoke checks.
export default defineConfig({
  ...experience,
  testMatch: [
    "employee-experience.spec.ts", "training-applications.spec.ts", "retirement-selection.spec.ts",
    "appraisal-targets.spec.ts", "hri-tasks.spec.ts", "spreadsheet-actions.spec.ts",
  ],
  grep: /@ui-smoke|training-applications|retirement-selection|appraisal-targets|hri-tasks|spreadsheet-actions/,
  outputDir: "./test-results/repository-audit",
  use: { ...experience.use, contextOptions: { reducedMotion: "reduce" } },
  webServer: servers.map((server, index) => index === 1 ? {
    ...server,
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
  } : server),
});
