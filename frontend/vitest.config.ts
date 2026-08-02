import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next resolves the real package at build time; Vitest needs a no-op server marker.
      "server-only": path.resolve(__dirname, "./src/test/server-only.ts"),
    },
  },
});
