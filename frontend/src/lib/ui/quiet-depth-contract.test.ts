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

  test("dashboard charts reserve enough room for four-digit axis labels", () => {
    const source = readSource("components", "dashboard", "dashboard-charts.tsx");

    expect(source).not.toContain("left: -10");
    expect(source.match(/left: 0/g)).toHaveLength(2);
    expect(source.match(/width=\{44\}/g)).toHaveLength(2);
  });

  test("dashboard charts use stable initial responsive dimensions", () => {
    const source = readSource("components", "dashboard", "dashboard-charts.tsx");

    expect(source).toContain("ResponsiveContainer");
    expect(source.match(/initialDimension=\{\{ width: 320, height: 224 \}\}/g)).toHaveLength(2);
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

  test("sidebar separates theme-aware domain rail from contextual navigation", () => {
    const source = readSource("components", "dashboard", "dashboard-sidebar.tsx");

    expect(source).toContain("shadow-[inset_3px_0_0_var(--primary)]");
    expect(source).toContain("function DomainRailItem");
    expect(source).toContain('className="vibe-rail flex shrink-0"');
    expect(source).toContain('className="flex w-[13rem] flex-col border-r border-border bg-[var(--vibe-sidebar-bg)]"');
    expect(source).toContain('src="/vibehr_mark.svg"');
    expect(source).toContain('className="h-8 w-8"');
    expect(source).not.toContain('src="/brand/vibehr-mark-white.svg"');
  });

  test("login starts with the demo administrator credentials", () => {
    const source = readSource("components", "auth", "login-card.tsx");

    expect(source.match(/defaultValue="admin"/g)).toHaveLength(2);
    expect(source).toContain("disabled={isSubmitting}");
    expect(source).not.toContain("disabled={isLoadingEnterCd || isSubmitting}");
  });

  test("login uses the chroma material and restores theme before hydration", () => {
    const login = readSource("app", "login", "page.tsx");
    const layout = readSource("app", "layout.tsx");
    const styles = readSource("app", "globals.css");

    expect(login).toContain("사람이 중심이 되는 HR의 시작");
    expect(login).toContain("구성원과 조직이 필요한 정보를 한곳에서 편리하게 관리합니다.");
    expect(login).toContain("login-brand-canvas");
    expect(login).toContain("whitespace-nowrap");
    expect(layout).toContain("vibe_hr_theme_preferences");
    expect(layout).toContain("suppressHydrationWarning");
    expect(styles).toContain('url("/images/vibe-chroma-material.avif")');
    expect(styles).toContain("--vibe-rail-bg:");
  });

  test("Vivid inactive navigation stays neutral in light and dark themes", () => {
    const source = readSource("app", "globals.css");

    expect(source).toContain("--vibe-nav-text: #4b5563;");
    expect(source).toContain("--vibe-nav-text-strong: #1f2937;");
    expect(source).toContain("--vibe-nav-text-muted: #6b7280;");
    expect(source).toContain("--vibe-nav-text: #d1d5db;");
    expect(source).toContain("--vibe-nav-text-strong: #f3f4f6;");
    expect(source).toContain("--vibe-nav-text-muted: #9ca3af;");
    expect(source).not.toContain("--vibe-nav-text: #5e239d;");
    expect(source).not.toContain("--vibe-nav-text: #ddd6fe;");
  });

  test("mobile sidebar overlay covers floating page tools", () => {
    const source = readSource("components", "dashboard", "dashboard-sidebar.tsx");

    expect(source).toContain('className="fixed inset-0 z-[60] lg:hidden"');
    expect(source).not.toContain('className="fixed inset-0 z-40 lg:hidden"');
  });

  test("dashboard failure guidance is Korean and recovery-oriented", () => {
    const source = readSource("app", "dashboard", "page.tsx");

    expect(source).toContain("대시보드 정보를 불러오지 못했습니다");
    expect(source).toContain("잠시 후 새로고침해 주세요");
    expect(source).not.toContain("Dashboard summary is currently unavailable");
  });

  test("dashboard clock hydrates from a deterministic placeholder", () => {
    const source = readSource("components", "dashboard", "dashboard-attendance-panel.tsx");

    expect(source).toContain('useState<string>("")');
    expect(source).toContain("window.requestAnimationFrame");
    expect(source).toContain("window.cancelAnimationFrame(frame)");
    expect(source).toContain("setClock(getKoreaDateTime())");
    expect(source).not.toContain("useState<string>(() => getKoreaDateTime())");
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

  test("dark grid fallbacks consume the active palette surfaces", () => {
    const source = readSource("app", "globals.css");

    expect(source).toContain("--ag-background-color: var(--vibe-surface-sunken);");
    expect(source).toContain("--ag-header-background-color: var(--grid-header-bg);");
    expect(source).toContain("--ag-input-background-color: var(--vibe-surface-raised);");
    expect(source).not.toContain("--ag-background-color: #0f172a;");
  });
});
