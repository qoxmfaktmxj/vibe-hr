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

  test("application shell separates canvas, header, and tab surfaces", () => {
    const source = readSource("components", "layout", "app-shell.tsx");

    expect(source).toContain("bg-background");
    expect(source).toContain("bg-card/95");
    expect(source).toContain("bg-[var(--vibe-surface-sunken)]/80");
    expect(source).not.toContain("bg-[var(--vibe-background-light)]");
  });

  test("sidebar active and brand states use the enterprise hierarchy", () => {
    const source = readSource("components", "dashboard", "dashboard-sidebar.tsx");

    expect(source).toContain("shadow-[inset_3px_0_0_var(--primary)]");
    expect(source).toContain("rounded-xl border border-border/70 bg-card shadow-sm");
    expect(source).not.toContain("rounded-lg bg-primary/10");
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
