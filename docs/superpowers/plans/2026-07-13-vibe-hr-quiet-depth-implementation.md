# VIBE-HR Quiet Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 Quiet Depth 디자인을 네 테마 조합과 공통 Enterprise UI 표면에 구현하고 확인된 시각·접근성·사용자 친화성 결함을 회귀 없이 수정한다.

**Architecture:** 기존 `ThemePreferences`와 HTML class/data attribute 계약은 유지한다. `globals.css`의 semantic token을 단일 진실 공급원으로 삼고 `Card`, `AppShell`, `DashboardSidebar`, dashboard chart, `ManagerGridSection`이 이를 소비하게 한다. 화면별 override 대신 공통 레이어를 수정하고 `/dashboard`, `/payroll/vouchers`를 대표 회귀 화면으로 검증한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts, AG Grid 35, Vitest, Playwright

---

## File Map

- Create `frontend/src/lib/ui/quiet-depth-contract.test.ts`: source-level styling contract and known-defect regression tests.
- Modify `frontend/src/app/globals.css`: four theme token sets, canvas glow, raised/sunken surfaces, shadows.
- Modify `frontend/src/components/ui/card.tsx`: shared raised surface contract.
- Modify `frontend/src/components/grid/manager-layout.tsx`: remove hard-coded white Grid surface without changing grid behavior.
- Modify `frontend/src/components/dashboard/dashboard-charts.tsx`: use valid semantic chart colors.
- Modify `frontend/src/components/layout/app-shell.tsx`: canvas/header/tab surface hierarchy.
- Modify `frontend/src/components/dashboard/dashboard-sidebar.tsx`: neutral navigation, active state, logo contrast, mobile surface.
- Modify `frontend/src/app/dashboard/page.tsx`: Korean recovery-oriented empty-state copy if the browser audit confirms the current English message.
- Create `output/design-review/quiet-depth/*.png`: browser evidence only; do not commit generated screenshots unless explicitly required.

### Task 1: Lock the UI contract with RED tests

**Files:**
- Create: `frontend/src/lib/ui/quiet-depth-contract.test.ts`

- [ ] **Step 1: Add source contract tests**

```ts
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
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npm run test -- src/lib/ui/quiet-depth-contract.test.ts`

Expected: four tests fail because the chart uses `hsl(var(--primary))`, the Grid uses `bg-white`, Card lacks the Quiet Depth shadow, and the new tokens do not exist.

- [ ] **Step 3: Commit the RED baseline**

```bash
git add frontend/src/lib/ui/quiet-depth-contract.test.ts docs/superpowers/plans/2026-07-13-vibe-hr-quiet-depth-implementation.md
git commit -m "test: lock Quiet Depth UI contracts"
```

### Task 2: Define semantic tokens and shared surfaces

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/components/ui/card.tsx`
- Modify: `frontend/src/components/grid/manager-layout.tsx`
- Test: `frontend/src/lib/ui/quiet-depth-contract.test.ts`

- [ ] **Step 1: Define the Standard Light surface contract in `:root`**

```css
--background: #eef3fa;
--card: #ffffff;
--sidebar: #f8fafc;
--vibe-background-light: #eef3fa;
--vibe-sidebar-bg: #f8fafc;
--vibe-canvas-glow: rgba(60, 109, 238, 0.08);
--vibe-surface-raised: #ffffff;
--vibe-surface-sunken: #e8eef7;
--vibe-shadow-card: 0 1px 2px rgba(15, 23, 42, 0.05), 0 10px 30px rgba(51, 65, 85, 0.08);
--vibe-shadow-floating: 0 18px 48px rgba(15, 23, 42, 0.16);
--vibe-border-emphasis: #cbd5e1;
```

- [ ] **Step 2: Define matching values in Vivid Light, Standard Dark, and Vivid Dark**

```css
/* Vivid Light */
--background: #f4f3f5;
--sidebar: #fbfafc;
--vibe-background-light: #f4f3f5;
--vibe-sidebar-bg: #fbfafc;
--vibe-canvas-glow: rgba(111, 67, 143, 0.07);
--vibe-surface-raised: #ffffff;
--vibe-surface-sunken: #ece8ef;
--vibe-shadow-card: 0 1px 2px rgba(46, 31, 56, 0.05), 0 10px 30px rgba(70, 47, 81, 0.08);
--vibe-shadow-floating: 0 18px 48px rgba(46, 31, 56, 0.17);
--vibe-border-emphasis: #d7cedc;

/* Standard Dark */
--background: #091321;
--card: #111e30;
--sidebar: #0d1a2d;
--vibe-background-light: #091321;
--vibe-sidebar-bg: #0d1a2d;
--vibe-canvas-glow: rgba(87, 126, 205, 0.10);
--vibe-surface-raised: #111e30;
--vibe-surface-sunken: #0c1727;
--vibe-shadow-card: 0 1px 2px rgba(0, 0, 0, 0.25), 0 14px 34px rgba(0, 0, 0, 0.20);
--vibe-shadow-floating: 0 22px 56px rgba(0, 0, 0, 0.38);
--vibe-border-emphasis: rgba(148, 163, 184, 0.18);

/* Vivid Dark */
--background: #100f18;
--card: #1b1723;
--sidebar: #181321;
--vibe-background-light: #100f18;
--vibe-sidebar-bg: #181321;
--vibe-canvas-glow: rgba(168, 118, 195, 0.09);
--vibe-surface-raised: #1b1723;
--vibe-surface-sunken: #14111b;
--vibe-shadow-card: 0 1px 2px rgba(0, 0, 0, 0.28), 0 14px 34px rgba(0, 0, 0, 0.22);
--vibe-shadow-floating: 0 22px 56px rgba(0, 0, 0, 0.42);
--vibe-border-emphasis: rgba(216, 180, 232, 0.16);
```

- [ ] **Step 3: Apply a restrained canvas glow**

```css
body {
  @apply bg-background text-foreground;
  background-image: radial-gradient(circle at 88% -10%, var(--vibe-canvas-glow), transparent 34rem);
  background-attachment: fixed;
}
```

- [ ] **Step 4: Connect shared Card and Grid surfaces**

`card.tsx` base class:

```tsx
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border border-border/80 py-6 shadow-[var(--vibe-shadow-card)]"
```

`manager-layout.tsx` Grid section class:

```tsx
"flex min-h-0 flex-1 flex-col rounded-xl border border-border/80 bg-card shadow-[var(--vibe-shadow-card)]"
```

- [ ] **Step 5: Run targeted tests and keep only the token/Card/Grid tests GREEN**

Run: `npm run test -- src/lib/ui/quiet-depth-contract.test.ts`

Expected: token, Card, and Grid tests pass; chart test remains RED until Task 3.

- [ ] **Step 6: Commit semantic surfaces**

```bash
git add frontend/src/app/globals.css frontend/src/components/ui/card.tsx frontend/src/components/grid/manager-layout.tsx
git commit -m "feat: add Quiet Depth semantic surfaces"
```

### Task 3: Correct chart, shell, sidebar, and brand hierarchy

**Files:**
- Modify: `frontend/src/components/dashboard/dashboard-charts.tsx`
- Modify: `frontend/src/components/layout/app-shell.tsx`
- Modify: `frontend/src/components/dashboard/dashboard-sidebar.tsx`
- Test: `frontend/src/lib/ui/quiet-depth-contract.test.ts`

- [ ] **Step 1: Fix Recharts color configuration**

```ts
const attendanceConfig = {
  count: { label: "출근", color: "var(--chart-1)" },
} satisfies ChartConfig;

const leaveConfig = {
  count: { label: "건수", color: "var(--chart-1)" },
} satisfies ChartConfig;
```

- [ ] **Step 2: Give AppShell distinct canvas, header, and tab surfaces**

Use `bg-background` for the shell, `bg-card/95 backdrop-blur-sm` for the top header, and `bg-[var(--vibe-surface-sunken)]/80` for the tab strip. Preserve all event handlers, storage keys, and tab markup.

```tsx
<div className="flex h-screen overflow-hidden bg-background text-[var(--vibe-text-base)]">
  <DashboardSidebar />
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    <header className="border-b border-border/80 bg-card/95 text-card-foreground backdrop-blur-sm">
```

- [ ] **Step 3: Make the Sidebar neutral by default and expressive only when active**

Keep `aria-current="page"`. Use `text-[color:var(--vibe-nav-text)]` for inactive entries and `bg-primary/12 text-primary shadow-[inset_3px_0_0_var(--primary)]` for active entries. Keep hover states neutral with `bg-accent/70`.

- [ ] **Step 4: Improve brand mark contrast without editing the SVG**

```tsx
<div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card shadow-sm">
  <Image
    src="/vibehr_mark.svg"
    alt="VIBE-HR"
    width={20}
    height={20}
    className="h-5 w-5"
    priority
  />
</div>
```

- [ ] **Step 5: Run targeted tests and AG Grid validation**

Run: `npm run test -- src/lib/ui/quiet-depth-contract.test.ts`

Expected: all tests pass.

Run: `npm run validate:grid`

Expected: all registered grid screens pass with unchanged toolbar contracts.

- [ ] **Step 6: Commit shared hierarchy changes**

```bash
git add frontend/src/components/dashboard/dashboard-charts.tsx frontend/src/components/layout/app-shell.tsx frontend/src/components/dashboard/dashboard-sidebar.tsx
git commit -m "feat: refine enterprise shell hierarchy"
```

### Task 4: Browser audit and bounded Enterprise UX fixes

**Files:**
- Modify only confirmed frontend files inside the approved common UI/dashboard scope.
- Modify `frontend/src/app/dashboard/page.tsx` when confirming the English empty-state copy.
- Add a regression assertion to `frontend/src/lib/ui/quiet-depth-contract.test.ts` for each code-fixed defect.

- [ ] **Step 1: Capture baseline screens**

Capture 1440×900 screenshots for Standard Light/Dark and Vivid Light/Dark dashboard, Standard/Vivid Dark `/payroll/vouchers`, and one 390×844 mobile sidebar state.

- [ ] **Step 2: Run visual-verdict before each edit iteration**

Persist each verdict to `.omx/state/vibe-hr-quiet-depth/ralph-progress.json`. Record severity, affected theme, evidence screenshot, and bounded fix.

- [ ] **Step 3: Fix confirmed issues with a failing regression test first**

If a finding requires a file outside the File Map, record an evidence-backed `add_subgoal` steering event before editing it. Do not expand the file scope implicitly.

For the known English empty-state copy, add this assertion before editing the page:

```ts
test("dashboard failure guidance is Korean and recovery-oriented", () => {
  const source = readSource("app", "dashboard", "page.tsx");
  expect(source).toContain("대시보드 정보를 불러오지 못했습니다");
  expect(source).not.toContain("Dashboard summary is currently unavailable");
});
```

Then use:

```tsx
<div role="status" className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
  대시보드 정보를 불러오지 못했습니다. 현재 값은 0으로 표시되며, 잠시 후 새로고침해 주세요.
</div>
```

- [ ] **Step 4: Re-capture and compare after every bounded fix**

Stop adding changes when no P0/P1/P2 visual, accessibility, responsive, hierarchy, or user-guidance defect remains in the required screens.

- [ ] **Step 5: Commit audited UX fixes**

```bash
git add frontend/src/lib/ui/quiet-depth-contract.test.ts frontend/src/app/dashboard/page.tsx
git commit -m "fix: resolve enterprise UX audit findings"
```

### Task 5: Full verification and final quality gate

**Files:**
- Update `docs/TASK_LEDGER.md` with R2 scope, approvals, changed files, verification, screenshots, and residual risks.

- [ ] **Step 1: Run automated verification in required order**

```bash
npm run validate:grid
npm run test
npm run lint
npm run build
```

Expected: every command exits 0 with no new errors.

- [ ] **Step 2: Run `ai-slop-cleaner` on changed files only**

Reject unrelated refactors, new abstractions, duplicated tokens, and per-screen overrides. Prefer deletion or reuse where equivalent code already exists.

- [ ] **Step 3: Rerun all automated and browser verification**

Use the same commands and screenshot matrix from Step 1/Task 4. Confirm real Korean rendering and no browser console errors.

- [ ] **Step 4: Run independent review**

Require `code-reviewer` recommendation `APPROVE` and `architect` status `CLEAR`. Treat any other result as a blocker story and resolve it before completion.

- [ ] **Step 5: Commit evidence and ledger**

```bash
git add docs/TASK_LEDGER.md
git commit -m "docs: record Quiet Depth verification"
```

- [ ] **Step 6: Checkpoint Ultragoal with structured evidence**

Only the final story may complete the aggregate Codex goal. Include post-cleaner verification commands, browser screenshot paths, and independent review evidence in the quality-gate JSON.
