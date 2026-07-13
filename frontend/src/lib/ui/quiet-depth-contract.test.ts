import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

function readSource(...segments: string[]) {
  return readFileSync(path.resolve(process.cwd(), "src", ...segments), "utf8");
}

describe("Quiet Depth UI contract", () => {
  test("dashboard charts use a valid semantic chart token", () => {
    const source = readSource("components", "dashboard", "dashboard-charts.tsx");

    expect(source).toContain('color: "var(--chart-1)"');
    expect(source).not.toContain("hsl(var(--primary))");
  });

  test("shared grid surface follows the active theme", () => {
    const source = readSource("components", "grid", "manager-layout.tsx");

    expect(source).toContain("bg-card");
    expect(source).not.toContain("bg-white");
  });

  test("shared cards consume the Quiet Depth shadow contract", () => {
    const source = readSource("components", "ui", "card.tsx");

    expect(source).toContain("shadow-[var(--vibe-shadow-card)]");
  });

  test("all theme combinations define the surface contract", () => {
    const source = readSource("app", "globals.css");

    expect(source.match(/--vibe-surface-raised:/g)).toHaveLength(4);
    expect(source.match(/--vibe-shadow-card:/g)).toHaveLength(4);
    expect(source).toContain("--vibe-canvas-glow:");
  });
});
