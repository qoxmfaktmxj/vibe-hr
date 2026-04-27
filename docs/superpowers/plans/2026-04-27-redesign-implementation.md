# Vibe-HR 전면 디자인 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vibe-HR 프로젝트(Next.js 16 + AG Grid + shadcn/ui + Tailwind v4)에 Hybrid D 디자인 시스템(Stripe baseline + Linear 다크 luminance + Apple-style 로그인 게이트웨이)을 적용. 색상 토큰 / 타이포 / 컴포넌트 그래머 / 사이드바 collapsible / 로그인 / 소비형 페이지 + 접근성 강화 (WCAG AA).

**Architecture:** 변경은 4단 + 1 검증 phase. Foundation(토큰·폰트·다크모드 정리) → Common Shell(사이드바·헤더·그리드 외피) → shadcn/ui(컴포넌트 토큰 매핑) → Pages(로그인·소비형 페이지) → Accessibility(WCAG AA 검증). 각 phase는 별도 PR로 분리. AG Grid 셀 내부는 변경 안 함 (Vibe-Grid 마이그레이션 호환).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, AG Grid, Pretendard Variable (`next/font/local`), Lucide icons, axe-core (a11y), Playwright (e2e).

**Reference Spec:** [docs/superpowers/specs/2026-04-27-redesign-design.md](../specs/2026-04-27-redesign-design.md) (commit `0dc58ca`, 14 sections).

---

## Sonnet Handoff Notes

이 플랜의 실제 코드 작성은 Sonnet 모델에서 실행합니다 (Opus는 spec/plan만 작성). 다음 두 가지 방법 중 선택:

**옵션 A — Sonnet 세션 (권장)**: 사용자가 새 Claude Code 세션을 Sonnet 모델로 시작하고, 첫 메시지에서 본 플랜을 가리킴. 예: "@docs/superpowers/plans/2026-04-27-redesign-implementation.md 의 Phase 1부터 task별로 진행해줘. `superpowers:executing-plans` 스킬 사용."

**옵션 B — Subagent (현재 세션 유지)**: Opus 메인 세션에서 `executor` subagent (Sonnet)로 task별 dispatch. 각 task가 self-contained라 fresh subagent마다 완전 컨텍스트 가능.

각 task는 다음을 포함하므로 Sonnet이 독립적으로 실행 가능:
- 정확한 파일 경로 (Create / Modify / Test)
- 완전한 코드 (placeholder 없음)
- 정확한 검증 명령 + 예상 출력
- atomic commit 메시지

**중요**: Phase 사이에는 사용자 검토 권장. PR 단위로 사용자가 시각 + 동작 확인 후 다음 phase 진입.

---

## Phases & PR Map

| Phase | 목적 | PR | Tasks | 의존성 |
|-------|------|-----|-------|--------|
| **1. Foundation** | 토큰·폰트·다크모드·`!important` 제거 | PR #1 | 1.1 ~ 1.9 | 없음 |
| **2. Common Shell** | 사이드바 collapsible·헤더·그리드 외피 | PR #2 | 2.1 ~ 2.8 | PR #1 |
| **3. shadcn/ui** | Button·Card·Input·Badge·Label 토큰 매핑 | PR #3 | 3.1 ~ 3.6 | PR #1 |
| **4. Pages** | 로그인·대시보드·소비형 페이지 | PR #4 | 4.1 ~ 4.5 | PR #2 + PR #3 |
| **5. Accessibility** | WCAG AA 검증·axe CI·reduced-motion | PR #5 | 5.1 ~ 5.7 | PR #4 |

각 phase 끝나면 사용자 시각 검토 → 다음 phase 진입.

---

## Common Verification Commands

각 phase 끝에 항상 실행 (전 phase 통과해야 다음 phase):

```bash
cd frontend
npm run validate:grid    # AG Grid 화면 정합성 (config/grid-screens.json)
npm run lint             # ESLint
npm run test             # Jest unit tests (있는 부분만)
npm run build            # Next.js 프로덕션 빌드
```

Phase 5 추가:
```bash
npx playwright test --grep '@a11y'    # axe-core 기반 a11y 테스트
```

각 task의 commit 메시지는 conventional commits 따름 (`feat:`, `fix:`, `style:`, `refactor:`, `chore:`).

---

# Phase 1: Foundation

## Task 1.1: Pretendard 패키지 설치

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: 의존성 설치**

```bash
cd frontend
npm install pretendard@^1.3.9
```

- [ ] **Step 2: package.json 확인**

`frontend/package.json` `dependencies`에 다음 추가됐는지 확인:
```json
"pretendard": "^1.3.9"
```

- [ ] **Step 3: 폰트 파일 경로 확인**

```bash
ls frontend/node_modules/pretendard/dist/web/variable/woff2/
```
Expected: `PretendardVariable.woff2` 존재.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install pretendard@^1.3.9 for design system fonts"
```

---

## Task 1.2: layout.tsx에 Pretendard 설정 + Inter 제거

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: 기존 layout.tsx 백업 의식 (Git diff로 확인 가능, 별도 파일 X)**

- [ ] **Step 2: layout.tsx 갱신**

`frontend/src/app/layout.tsx` 의 import 부분과 폰트 정의 부분 교체:

```tsx
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { Providers } from "@/components/providers";

import "./globals.css";

const DEFAULT_APP_ORIGIN = "http://localhost:3000";

function resolveMetadataBase(): URL {
  const appOrigin = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? DEFAULT_APP_ORIGIN;

  try {
    return new URL(appOrigin);
  } catch {
    return new URL(DEFAULT_APP_ORIGIN);
  }
}

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "VIBE-HR",
  description: "VIBE-HR MVP with Next.js + FastAPI + SQLModel",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "VIBE-HR",
    description: "VIBE-HR MVP with Next.js + FastAPI + SQLModel",
    images: [{ url: "/vibe-hr-thumbnail.webp", width: 1200, height: 630, type: "image/webp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VIBE-HR",
    description: "VIBE-HR MVP with Next.js + FastAPI + SQLModel",
    images: ["/vibe-hr-thumbnail.webp"],
  },
  other: {
    "msapplication-config": "/browserconfig.xml",
    "msapplication-TileColor": "#3C6DEE",
  },
};

export const viewport: Viewport = {
  themeColor: "#3C6DEE",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="antialiased">
        <Providers initialUser={null} initialMenus={[]}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

변경 사항: `import { Inter } from "next/font/google"` 제거, `import localFont from "next/font/local"` 추가, `const inter = Inter(...)` → `const pretendard = localFont(...)`, `<html className={pretendard.variable}>`, `<body className="antialiased">` (Inter 변수 className 제거).

- [ ] **Step 3: 빌드로 폰트 로드 검증**

```bash
cd frontend
npm run build
```

Expected: 빌드 성공. `Inter` 관련 경고 없음. `pretendard` 폰트 파일이 `.next/static/media/`에 포함됨.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat(font): replace Inter with self-hosted Pretendard Variable"
```

---

## Task 1.3: globals.css 라이트 모드 토큰 갱신

**Files:**
- Modify: `frontend/src/app/globals.css:9-101` (`:root` block)

- [ ] **Step 1: `@theme inline` 블록의 `--font-sans` 갱신**

`frontend/src/app/globals.css:12` 라인:
```css
--font-sans: var(--font-inter);
```
을 다음으로 교체:
```css
--font-sans: var(--font-pretendard), system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
```

- [ ] **Step 2: `:root` 블록 (51~101 라인) 갱신**

기존 라이트 토큰 + 신규 추가 (`--primary-hover`, `--primary-soft`, `--success`, `--warning`, `--border-soft`):

```css
:root {
  --radius: 0.75rem;
  --background: #f6f6f8;
  --foreground: #111318;
  --card: #ffffff;
  --card-foreground: #111318;
  --popover: #ffffff;
  --popover-foreground: #111318;
  --primary: #3c6dee;
  --primary-foreground: #ffffff;
  --primary-hover: #2f5cd8;
  --primary-soft: #eef4ff;
  --secondary: #eef2ff;
  --secondary-foreground: #1f2937;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #eff4ff;
  --accent-foreground: #1f2937;
  --destructive: #cc2936;
  --success: #15be53;
  --success-foreground: #108c3d;
  --warning: #d97706;
  --warning-foreground: #b45309;
  --border: #e2e8f0;
  --border-soft: #f1f5f9;
  --input: #e2e8f0;
  --ring: #3c6dee;
  --chart-1: #3c6dee;
  --chart-2: #7a9cec;
  --chart-3: #0ea5e9;
  --chart-4: #b95f89;
  --chart-5: #cc2936;
  --sidebar: #f8fafc;
  --sidebar-foreground: #111318;
  --sidebar-primary: #3c6dee;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #eff4ff;
  --sidebar-accent-foreground: #3c6dee;
  --sidebar-border: #e5e7eb;
  --sidebar-ring: #3c6dee;

  --vibe-primary-login: #3a6aee;
  --vibe-primary: #3c6dee;
  --vibe-primary-light: #7a9cec;
  --vibe-action: #0ea5e9;
  --vibe-save: #0ea5e9;
  --vibe-warning: #b95f89;
  --vibe-sidebar-bg: #f8fafc;
  --vibe-accent-rose: #b95f89;
  --vibe-accent-muted: #64748b;
  --vibe-accent-red: #cc2936;
  --vibe-background-light: #f6f6f8;
  --vibe-background-dark: #101522;
  --vibe-text-base: #111318;
  --vibe-nav-text: #334155;
  --vibe-nav-text-strong: #0f172a;
  --vibe-nav-text-muted: #64748b;
}
```

- [ ] **Step 3: 페이지 캔버스 위 격상 토큰 추가 (대조비 이슈)**

`:root` 블록 끝(직전)에 추가:

```css
  /* WCAG 격상 — 페이지 캔버스(#f6f6f8) 위에서 사용 */
  --muted-foreground-on-bg: #475569;  /* 7.6:1 (#64748b 4.4:1 → 격상) */
  --primary-on-bg: #2f5cd8;            /* 5.4:1 (#3c6dee 4.4:1 → 격상) */
}
```

- [ ] **Step 4: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

Expected: PASS (CSS 변수만 추가/갱신이라 컴파일 영향 없음).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(theme): update light tokens with hover/soft/success/warning + WCAG AA escalations"
```

---

## Task 1.4: globals.css 다크 모드 토큰 갱신 (Linear luminance stacking)

**Files:**
- Modify: `frontend/src/app/globals.css:193-237` (`.dark` block)

- [ ] **Step 1: `.dark` 블록 갱신**

`frontend/src/app/globals.css:193-237` 라인의 `.dark` 블록을 다음으로 교체:

```css
.dark {
  --background: #101522;
  --foreground: #f8fafc;
  --card: rgba(255, 255, 255, 0.03);
  --card-foreground: #f8fafc;
  --popover: #111827;
  --popover-foreground: #f8fafc;
  --primary: #7a9cec;
  --primary-foreground: #111827;
  --primary-hover: #9fb8ff;
  --primary-soft: rgba(60, 109, 238, 0.18);
  --secondary: rgba(255, 255, 255, 0.04);
  --secondary-foreground: #f8fafc;
  --muted: rgba(255, 255, 255, 0.04);
  --muted-foreground: #94a3b8;
  --accent: rgba(255, 255, 255, 0.05);
  --accent-foreground: #f8fafc;
  --destructive: #e04551;
  --success: #10b981;
  --success-foreground: #34d399;
  --warning: #fbbf24;
  --warning-foreground: #fde68a;
  --border: rgba(255, 255, 255, 0.08);
  --border-soft: rgba(255, 255, 255, 0.05);
  --input: rgba(255, 255, 255, 0.08);
  --ring: #7a9cec;
  --sidebar: #0f172a;
  --sidebar-foreground: #f8fafc;
  --sidebar-primary: #7a9cec;
  --sidebar-primary-foreground: #0f172a;
  --sidebar-accent: rgba(255, 255, 255, 0.06);
  --sidebar-accent-foreground: #f8fafc;
  --sidebar-border: rgba(255, 255, 255, 0.06);
  --sidebar-ring: #7a9cec;

  --vibe-primary-login: #7a9cec;
  --vibe-primary: #7a9cec;
  --vibe-primary-light: #9fb8ff;
  --vibe-action: #38bdf8;
  --vibe-save: #38bdf8;
  --vibe-warning: #f59e0b;
  --vibe-sidebar-bg: #0f172a;
  --vibe-accent-rose: #c084fc;
  --vibe-accent-muted: #94a3b8;
  --vibe-accent-red: #f87171;
  --vibe-background-light: #0b1220;
  --vibe-background-dark: #030712;
  --vibe-text-base: #e2e8f0;
  --vibe-nav-text: #cbd5e1;
  --vibe-nav-text-strong: #f8fafc;
  --vibe-nav-text-muted: #94a3b8;

  /* WCAG 격상 — 다크 모드는 모든 토큰이 이미 5:1+ 통과 */
  --muted-foreground-on-bg: #94a3b8;
  --primary-on-bg: #7a9cec;
}
```

핵심 변경: `--card`/`--secondary`/`--muted`/`--accent`/`--border`/`--input`을 solid hex에서 `rgba(255,255,255, X)`로 전환. Linear luminance stacking 패턴 적용.

- [ ] **Step 2: Lint + Build + 다크 모드 시각 검증 준비**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 3: Dev 서버에서 다크 모드 시각 확인 (수동)**

```bash
npm run dev
```

브라우저 `http://localhost:3000` → 로그인 → 다크 모드 토글 (theme settings popover) → 그리드 페이지 진입. 카드/사이드바/입력/그리드 행 모두 깨지지 않는지 확인. **알려진 이슈**: `globals.css:271-319` 의 `!important` 글로벌 오버라이드가 아직 살아있어 일부 요소가 강제 변경됨. 다음 task에서 제거.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(theme): apply Linear luminance stacking to dark mode tokens"
```

---

## Task 1.5: globals.css `vivid` 팔레트 갱신

**Files:**
- Modify: `frontend/src/app/globals.css:103-149` + `:343-369`

- [ ] **Step 1: 라이트 vivid 블록 (103~149 라인) 교체**

```css
:root[data-palette="vivid"] {
  --background: #f4f4ed;
  --foreground: #2a1542;
  --card: #ffffff;
  --card-foreground: #2a1542;
  --popover: #ffffff;
  --popover-foreground: #2a1542;
  --primary: #5e239d;
  --primary-foreground: #ffffff;
  --primary-hover: #4a1c80;
  --primary-soft: #f6e9ff;
  --secondary: #f6e9ff;
  --secondary-foreground: #2a1542;
  --muted: #eef9f4;
  --muted-foreground: #5e239d;
  --accent: #6decaf;
  --accent-foreground: #2a1542;
  --destructive: #d35269;
  --success: #00b58a;
  --warning: #d97706;
  --border: #e4ddee;
  --border-soft: #efe9f5;
  --input: #e4ddee;
  --ring: #5e239d;
  --chart-1: #5e239d;
  --chart-2: #a78bfa;
  --chart-3: #6decaf;
  --chart-4: #00b58a;
  --chart-5: #d35269;
  --sidebar: #f9f8fb;
  --sidebar-foreground: #2a1542;
  --sidebar-primary: #5e239d;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f6e9ff;
  --sidebar-accent-foreground: #5e239d;
  --sidebar-border: #e4ddee;
  --sidebar-ring: #5e239d;
  --vibe-primary: #5e239d;
  --vibe-primary-light: #a78bfa;
  --vibe-action: #00b58a;
  --vibe-save: #5e239d;
  --vibe-warning: #d35269;
  --vibe-sidebar-bg: #f9f8fb;
  --vibe-accent-rose: #5e239d;
  --vibe-accent-muted: #6b7280;
  --vibe-accent-red: #d35269;
  --vibe-background-light: #f4f4ed;
  --vibe-text-base: #2a1542;
  --vibe-nav-text: #5e239d;
  --vibe-nav-text-strong: #2a1542;
  --vibe-nav-text-muted: #5e239d;

  --muted-foreground-on-bg: #4a1c80;
  --primary-on-bg: #4a1c80;
}
```

핵심 변경: `--primary` `#f61067` → `#5e239d` (마젠타 → 딥 퍼플로 정착). `--success`, `--warning`, `--primary-hover`, `--primary-soft` 신규 추가. 차트 색상 vivid 톤으로 매핑.

- [ ] **Step 2: 다크 vivid 블록 (343~369 라인) 교체**

```css
.dark[data-palette="vivid"] {
  --background: #12101d;
  --foreground: #f5f3ff;
  --card: rgba(255, 255, 255, 0.03);
  --card-foreground: #f5f3ff;
  --popover: #1b1530;
  --popover-foreground: #f5f3ff;
  --primary: #a78bfa;
  --primary-foreground: #12101d;
  --primary-hover: #c4b5fd;
  --primary-soft: rgba(94, 35, 157, 0.22);
  --secondary: rgba(255, 255, 255, 0.04);
  --secondary-foreground: #f5f3ff;
  --muted: rgba(255, 255, 255, 0.04);
  --muted-foreground: #c4b5fd;
  --accent: rgba(109, 236, 175, 0.16);
  --accent-foreground: #f5f3ff;
  --border: rgba(255, 255, 255, 0.08);
  --border-soft: rgba(255, 255, 255, 0.05);
  --input: rgba(255, 255, 255, 0.08);
  --ring: #a78bfa;
  --sidebar: #140f24;
  --sidebar-foreground: #f5f3ff;
  --sidebar-primary: #a78bfa;
  --sidebar-primary-foreground: #12101d;
  --sidebar-accent: rgba(255, 255, 255, 0.06);
  --sidebar-accent-foreground: #f5f3ff;
  --sidebar-border: rgba(255, 255, 255, 0.06);
  --vibe-sidebar-bg: #140f24;
  --vibe-background-light: #12101d;
  --vibe-text-base: #f5f3ff;
  --vibe-nav-text: #ddd6fe;
  --vibe-nav-text-strong: #f5f3ff;
  --vibe-nav-text-muted: #c4b5fd;

  --muted-foreground-on-bg: #c4b5fd;
  --primary-on-bg: #a78bfa;
}
```

- [ ] **Step 3: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 4: Dev 서버에서 vivid 팔레트 시각 확인**

```bash
npm run dev
```

테마 설정에서 vivid 팔레트로 토글 후 라이트/다크 모두 확인.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(theme): redesign vivid palette with deep purple primary + new tokens"
```

---

## Task 1.6: globals.css 다크 모드 `!important` 글로벌 오버라이드 제거

**Files:**
- Modify: `frontend/src/app/globals.css:271-319`

- [ ] **Step 1: 271~319 라인의 `.dark .bg-white`, `.dark .text-black`, `.dark .border-gray-*`, `.dark input`, `.dark .odd\:bg-white` 등 글로벌 오버라이드 블록 모두 제거**

다음 라인들을 통째로 삭제 (스크롤바 스타일은 유지, 그 외 모든 `!important` 강제 변경 제거):

```css
/* 삭제 대상 — 271~319 라인의 다음 블록들 */
.dark .bg-white,
.dark .bg-slate-50,
.dark .bg-slate-100,
.dark .bg-gray-50,
.dark .bg-gray-100 {
  background-color: var(--card) !important;
}
.dark .text-black,
.dark .text-gray-900,
.dark .text-gray-800,
.dark .text-gray-700,
.dark .text-slate-900,
.dark .text-slate-800,
.dark .text-slate-700 {
  color: #f1f5f9 !important;
}
.dark .text-gray-600,
.dark .text-gray-500,
.dark .text-slate-600,
.dark .text-slate-500 {
  color: #cbd5e1 !important;
}
.dark .border-gray-200,
.dark .border-gray-100,
.dark .border-slate-200,
.dark .border-slate-100 {
  border-color: var(--border) !important;
}
.dark input,
.dark select,
.dark textarea {
  background-color: var(--muted);
  color: var(--foreground);
  border-color: var(--border);
}
.dark input::placeholder,
.dark textarea::placeholder {
  color: #94a3b8;
}
.dark .hover\:bg-white:hover,
.dark .hover\:bg-slate-50:hover,
.dark .hover\:bg-slate-100:hover {
  background-color: var(--accent) !important;
}
.dark .odd\:bg-white:nth-child(odd),
.dark .even\:bg-slate-50:nth-child(even) {
  background-color: color-mix(in oklab, var(--card) 90%, black 10%) !important;
}
```

**유지 대상**: `frontend/src/app/globals.css:252-269` 의 `.dark` 스크롤바 스타일은 그대로 유지.

- [ ] **Step 2: hardcoded 색상 클래스 사용처 검색**

```bash
cd frontend
grep -rn "bg-white\|text-black\|text-gray-9\|text-gray-7\|text-slate-9\|border-gray-2\|border-gray-1\|border-slate-2\|border-slate-1" src --include="*.tsx" --include="*.ts" | head -50
```

이런 hardcoded Tailwind 색상이 사용된 위치 파악. `!important` 제거 후 다크 모드에서 이 부분이 깨질 가능성. 다음 단계에서 토큰으로 치환.

- [ ] **Step 3: Dev 서버에서 다크 모드 시각 검증 (회귀 테스트)**

```bash
npm run dev
```

다크 모드 → 모든 메인 페이지 (대시보드, 사원관리, 발령, 부서, 근태) 빠르게 둘러보기. 깨진 부분(흰 배경, 검은 텍스트가 다크에서 잘못 표시) 메모.

- [ ] **Step 4: 깨진 hardcoded 색상을 토큰으로 치환**

각 깨진 위치에서:
- `bg-white` → `bg-card`
- `text-black`, `text-gray-900` → `text-foreground`
- `text-gray-700`, `text-slate-700` → `text-foreground` 또는 `text-muted-foreground`
- `text-gray-500`, `text-slate-500` → `text-muted-foreground`
- `border-gray-200`, `border-slate-200` → `border-border`
- `bg-slate-50`, `bg-gray-50` → `bg-muted`

치환 작업은 grep 결과 따라 파일별로 직접 수정. 한 파일씩.

- [ ] **Step 5: Lint + Build + 다크 회귀 재확인**

```bash
npm run lint
npm run build
npm run dev    # 다크 모드 다시 확인
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/globals.css frontend/src
git commit -m "refactor(theme): remove dark mode !important overrides, use semantic tokens"
```

---

## Task 1.7: 한글/영문 letter-spacing 분리 + Pretendard ss03/ss01

**Files:**
- Modify: `frontend/src/app/globals.css` (마지막에 추가)

- [ ] **Step 1: globals.css 마지막에 typography 규칙 추가**

```css
/* ============================================================ */
/* Typography — Pretendard OpenType + lang-aware tracking         */
/* ============================================================ */
:root {
  font-feature-settings: "ss03", "ss01";
}

body {
  font-family: var(--font-sans);
  letter-spacing: 0; /* 한글 기준 디폴트 */
}

/* 영문/숫자가 다수인 헤딩에 negative tracking */
.tracking-tight {
  letter-spacing: -0.02em;
}
.tracking-tighter {
  letter-spacing: -0.025em;
}

/* CJK 섞인 헤딩에서 영문 부분만 negative tracking */
.heading-mixed :lang(en),
.heading-mixed [lang="en"] {
  letter-spacing: -0.02em;
}

/* 숫자는 tabular + tracking 0 */
.tnum, .tabular-nums {
  font-feature-settings: "tnum", "ss03", "ss01";
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}
```

- [ ] **Step 2: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 3: Dev 서버에서 시각 확인**

```bash
npm run dev
```

페이지 헤딩, 카드 타이틀, 숫자 표시 (예: 사원관리의 "1,247명") 확인. 한글이 너무 좁아 보이지 않는지, 영문 부분은 적절히 tight한지.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(typography): add lang-aware letter-spacing + Pretendard ss03/ss01 features"
```

---

## Task 1.8: AG Grid 다크 변수 매핑 정리 + `!important` 제거

**Files:**
- Modify: `frontend/src/app/globals.css:391-453` (`.dark .ag-theme-quartz` block)

- [ ] **Step 1: 391~453 라인 갱신**

기존 `.dark .ag-theme-quartz .ag-* { ... !important }` 블록의 `!important` 모두 제거. CSS 변수만 남기고 강제 오버라이드 삭제. 다음으로 교체:

```css
/* ============================================================ */
/* AG Grid dark fallback — variables only, no !important         */
/* ============================================================ */
.dark .ag-theme-quartz {
  --ag-background-color: #0f172a;
  --ag-foreground-color: #e2e8f0;
  --ag-header-background-color: #1e293b;
  --ag-header-foreground-color: #cbd5e1;
  --ag-border-color: rgba(255, 255, 255, 0.08);
  --ag-row-border-color: rgba(255, 255, 255, 0.05);
  --ag-odd-row-background-color: #0f172a;
  --ag-control-panel-background-color: #111827;
  --ag-selected-row-background-color: #1e3a5f;
  --ag-row-hover-color: #1b2a45;
  --ag-range-selection-background-color: rgba(60, 109, 238, 0.20);
  --ag-input-background-color: #0f172a;
  --ag-input-foreground-color: #e2e8f0;
  --ag-input-border-color: rgba(255, 255, 255, 0.08);
}
```

기존 `.dark .ag-theme-quartz .ag-root-wrapper { background-color: #0f172a !important; }` 등의 모든 element-level `!important` 규칙은 삭제 (CSS 변수가 처리).

- [ ] **Step 2: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 3: AG Grid 화면 다크 모드 시각 검증**

```bash
npm run dev
```

다크 모드 → 사원관리 (`/hr/employee`) → 그리드 헤더, 행, hover, selected 모두 정상 표시되는지. 흰색 박스 잔존 없는지.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "refactor(grid): clean up AG Grid dark mode CSS variables, remove !important"
```

---

## Task 1.9: Foundation Phase 검증 + PR

- [ ] **Step 1: 전체 검증**

```bash
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
```

Expected: 모두 PASS.

- [ ] **Step 2: Dev 서버에서 라이트 + 다크 + vivid 라이트 + vivid 다크 4가지 조합 빠른 시각 검증**

```bash
npm run dev
```

테마 토글 → 4가지 모드에서 로그인, 대시보드, 사원관리, 발령, 부서 페이지 흝어보기. 깨진 부분 없는지.

- [ ] **Step 3: PR #1 생성**

```bash
git push -u origin claude/compassionate-villani-2563d4
gh pr create --title "feat(design): foundation — tokens, fonts, dark luminance stacking" --body "$(cat <<'EOF'
## Summary
- Pretendard Variable self-host (Inter 제거)
- 라이트/다크 토큰 갱신 (hover/soft/success/warning + WCAG AA 격상)
- Linear luminance stacking 다크 모드 적용
- vivid 팔레트 딥 퍼플로 갱신
- 다크 모드 \`!important\` 떡칠 제거 → 토큰 기반
- 한글/영문 letter-spacing 분리
- AG Grid 다크 변수 매핑 정리

## Test plan
- [ ] Light + Dark 모드 모든 메인 페이지 시각 확인
- [ ] Vivid 팔레트 라이트/다크 시각 확인
- [ ] AG Grid 화면(사원관리, 발령, 부서) 다크 모드에서 깨짐 없음
- [ ] \`npm run validate:grid\`, \`lint\`, \`test\`, \`build\` 모두 PASS

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: 사용자 검토 대기**

PR이 머지되면 Phase 2 진입.

---

# Phase 2: Common Shell

## Task 2.1: useSidebarCollapsed hook

**Files:**
- Create: `frontend/src/hooks/use-sidebar-collapsed.ts`
- Test: `frontend/src/hooks/use-sidebar-collapsed.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/hooks/use-sidebar-collapsed.test.ts`:

```ts
import { renderHook, act } from "@testing-library/react";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

describe("useSidebarCollapsed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("기본값은 false (expanded)", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle로 상태 변경 + localStorage 저장", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem("vibe-sidebar-collapsed")).toBe("true");
  });

  it("localStorage에서 초기값 복원", () => {
    localStorage.setItem("vibe-sidebar-collapsed", "true");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend
npm run test -- use-sidebar-collapsed
```

Expected: FAIL — `Cannot find module './use-sidebar-collapsed'`.

- [ ] **Step 3: hook 구현**

`frontend/src/hooks/use-sidebar-collapsed.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vibe-sidebar-collapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const setCollapsedExplicit = useCallback((value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  return { collapsed, toggle, setCollapsed: setCollapsedExplicit };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test -- use-sidebar-collapsed
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/use-sidebar-collapsed.ts frontend/src/hooks/use-sidebar-collapsed.test.ts
git commit -m "feat(layout): add useSidebarCollapsed hook with localStorage persistence"
```

---

## Task 2.2: dashboard-sidebar.tsx Collapsible 토글 구현

**Files:**
- Modify: `frontend/src/components/dashboard/dashboard-sidebar.tsx`

- [ ] **Step 1: 현재 dashboard-sidebar 구조 파악**

```bash
cat frontend/src/components/dashboard/dashboard-sidebar.tsx | head -50
```

기존 props, layout, nav-item rendering 패턴 확인.

- [ ] **Step 2: useSidebarCollapsed hook 통합**

`dashboard-sidebar.tsx`의 컴포넌트 함수 시그니처 갱신. 핵심 추가:

```tsx
"use client";

import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ... 기존 import

export function DashboardSidebar(props: DashboardSidebarProps) {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-180 ease-out",
        collapsed ? "w-[60px]" : "w-[200px]"
      )}
      aria-label="메인 메뉴"
    >
      {/* 로고 */}
      <div className={cn("h-[44px] flex items-center px-3", collapsed && "justify-center px-0")}>
        <span className={cn("font-bold tracking-wide text-sidebar-primary transition-opacity duration-100", collapsed ? "text-[10px]" : "text-sm")}>
          {collapsed ? "VH" : "VIBE-HR"}
        </span>
      </div>

      {/* nav 그룹 */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-2" aria-label="페이지 카테고리">
        {/* 카테고리 그룹 (HR / ORG / TIM ...) */}
        {/* 각 그룹은 props.menuTree에서 렌더 */}
        {/* collapsed 상태일 때 카테고리 라벨 hairline divider만 */}
      </nav>

      {/* 토글 버튼 */}
      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          className="w-full h-8 flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors text-muted-foreground"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
```

기존 nav-item rendering 부분(menu tree map)을 collapsed 모드 호환으로 갱신:
- Expanded: icon + text 라벨 + chevron
- Collapsed: icon만 (text hidden via `<span className={cn("transition-opacity duration-100", collapsed && "opacity-0 sr-only")}>...`)

- [ ] **Step 3: nav-item 코드 (collapsed 호환)**

`dashboard-sidebar.tsx`의 nav-item 렌더 함수 (기존 패턴 따라 어댑트):

```tsx
function NavItem({ menu, active, collapsed }: { menu: MenuNode; active: boolean; collapsed: boolean }) {
  const Icon = menu.icon ?? Home;
  return (
    <Link
      href={menu.path}
      aria-current={active ? "page" : undefined}
      title={collapsed ? menu.label : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
        collapsed && "justify-center"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{menu.label}</span>}
    </Link>
  );
}
```

- [ ] **Step 4: 카테고리 그룹 라벨 (collapsed 모드)**

```tsx
function NavGroup({ title, items, collapsed }: { title: string; items: MenuNode[]; collapsed: boolean }) {
  return (
    <div className="space-y-0.5">
      {collapsed ? (
        <div className="my-1.5 mx-2 h-px bg-sidebar-border" aria-hidden="true" />
      ) : (
        <div className="px-2 pt-1.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      {items.map((item) => (
        <NavItem key={item.id} menu={item} active={isActive(item)} collapsed={collapsed} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 6: Dev에서 토글 동작 확인**

```bash
npm run dev
```

사이드바 우측 하단 chevron 클릭 → 60px ↔ 200px 토글. 새로고침 후 상태 유지.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/dashboard/dashboard-sidebar.tsx
git commit -m "feat(sidebar): add collapsible toggle (200px ↔ 60px) with localStorage persistence"
```

---

## Task 2.3: Mobile에서 collapsible 비활성 (drawer만)

**Files:**
- Modify: `frontend/src/components/dashboard/dashboard-sidebar.tsx`
- Modify: `frontend/src/components/layout/app-shell.tsx`

- [ ] **Step 1: 모바일 분기 추가 (md 미만은 drawer)**

`dashboard-sidebar.tsx`의 `<aside>` className 갱신:

```tsx
className={cn(
  "flex flex-col bg-sidebar border-r border-sidebar-border",
  // 데스크톱(md+): collapsible
  "md:transition-[width] md:duration-180 md:ease-out",
  collapsed ? "md:w-[60px]" : "md:w-[200px]",
  // 모바일: drawer 패턴 (별도 mobile drawer 컴포넌트가 처리, 여기는 desktop only)
  "hidden md:flex"
)}
```

- [ ] **Step 2: Mobile drawer 컴포넌트는 기존 `MobileNav` 또는 hamburger 패턴 활용**

`app-shell.tsx`에서 모바일 헤더의 hamburger 버튼이 `<Sheet>` 또는 `<Drawer>` 형태로 사이드바 컨텐츠를 표시하도록 어댑트. 기존 컴포넌트가 있으면 재활용, 없으면 shadcn의 `<Sheet>` 컴포넌트 추가:

```bash
cd frontend
npx shadcn@latest add sheet
```

(이미 설치돼 있으면 skip)

`app-shell.tsx`에 모바일 drawer 추가:

```tsx
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

// 헤더 좌측에:
<Sheet>
  <SheetTrigger asChild className="md:hidden">
    <button aria-label="메뉴 열기" className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent">
      <Menu className="h-5 w-5" />
    </button>
  </SheetTrigger>
  <SheetContent side="left" className="w-[280px] p-0">
    {/* DashboardSidebar의 nav 부분만 모바일용으로 항상 expanded 모드로 렌더 */}
    <MobileSidebarContent menuTree={menuTree} />
  </SheetContent>
</Sheet>
```

- [ ] **Step 3: Build + 모바일 viewport에서 확인**

```bash
npm run build
npm run dev
```

브라우저 devtools 모바일 모드 (375px) → hamburger → drawer가 좌측에서 슬라이드. 데스크톱(>768px) → 사이드바 그대로 + collapsible.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/dashboard-sidebar.tsx frontend/src/components/layout/app-shell.tsx
git commit -m "feat(sidebar): add mobile drawer (Sheet), collapsible only on md+"
```

---

## Task 2.4: app-shell.tsx 헤더 디자인 갱신

**Files:**
- Modify: `frontend/src/components/layout/app-shell.tsx`

- [ ] **Step 1: 헤더 73px 고정 + 디자인 토큰 적용**

`app-shell.tsx`의 헤더 부분 (logo + actions) 갱신:

```tsx
<header className="h-[73px] flex items-center justify-between px-4 md:px-6 bg-card border-b border-border">
  {/* 좌측: 모바일 hamburger + 로고 (모바일만) + 검색 */}
  <div className="flex items-center gap-3 flex-1 max-w-md">
    {/* mobile hamburger (Task 2.3 참조) */}
    <Sheet>...</Sheet>

    {/* 검색 바 */}
    <div className="hidden md:flex items-center gap-2 flex-1 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground">
      <Search className="h-4 w-4" />
      <input
        type="text"
        placeholder="메뉴 검색"
        className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        aria-label="메뉴 검색"
      />
      <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-card border border-border text-muted-foreground">
        <span>⌘</span>K
      </kbd>
    </div>
  </div>

  {/* 우측: 알림 / 설정 / 아바타 / 로그아웃 */}
  <div className="flex items-center gap-2">
    <SessionCountdown />
    <ImpersonationPopoverNoSsr />
    <ThemeSettingsPopoverNoSsr />
    {/* 알림 버튼 */}
    <button aria-label="알림" className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground">
      <Bell className="h-4 w-4" />
    </button>
    {/* 사용자 아바타 */}
    <UserAvatar />
    <LogoutButton />
  </div>
</header>
```

기존 import에 `Search`, `Bell` from `lucide-react` 추가.

- [ ] **Step 2: ManagerPageShell의 height 계산 식 호환 확인**

기존 `frontend/src/components/grid/manager-layout.tsx:27` 의 `h-[calc(100vh-73px)]` 가 그대로 작동하는지 (헤더 73px 유지).

- [ ] **Step 3: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/app-shell.tsx
git commit -m "feat(layout): redesign header (73px, search bar, action cluster)"
```

---

## Task 2.5: ManagerPageShell + ManagerSearchSection 디자인 갱신

**Files:**
- Modify: `frontend/src/components/grid/manager-layout.tsx`

- [ ] **Step 1: ManagerPageShell 갱신**

`frontend/src/components/grid/manager-layout.tsx:18-35` 의 `ManagerPageShell` 갱신:

```tsx
export function ManagerPageShell({
  children,
  className,
  containerRef,
  onPasteCapture,
}: ManagerPageShellProps) {
  return (
    <AgGridModulesProvider>
      <div
        className={cn(
          "flex h-[calc(100vh-73px)] flex-col gap-3 px-3 py-3 md:px-6 md:py-4 bg-background",
          className
        )}
        ref={containerRef}
        onPasteCapture={onPasteCapture}
      >
        {children}
      </div>
    </AgGridModulesProvider>
  );
}
```

핵심 변경: `bg-background` 추가 (페이지 캔버스 토큰).

- [ ] **Step 2: ManagerSearchSection 갱신**

`ManagerSearchSection` 카드의 className 갱신:

```tsx
export function ManagerSearchSection({
  title,
  children,
  onQuery,
  queryLabel = "조회",
  queryDisabled = false,
  queryButtonClassName,
  className,
}: ManagerSearchSectionProps) {
  return (
    <Card className={cn("gap-0 py-0 rounded-xl border-border shadow-[rgba(50,50,93,0.06)_0_4px_12px_-4px,rgba(0,0,0,0.04)_0_2px_6px]", className)}>
      <CardHeader className="px-3 pb-2 pt-4 md:px-6 md:pt-3">
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 md:px-6 md:pb-4 space-y-3">
        {children}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={onQuery}
            disabled={queryDisabled}
            className={cn("rounded-lg", queryButtonClassName)}
          >
            {queryLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Lint + Build + validate:grid**

```bash
cd frontend
npm run lint
npm run build
npm run validate:grid
```

- [ ] **Step 4: Dev에서 사원관리 페이지 시각 확인**

```bash
npm run dev
```

`/hr/employee` → 페이지 헤더, 검색 카드, 그리드 카드, 페이지네이션 모두 정상.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/grid/manager-layout.tsx
git commit -m "feat(grid): apply Stripe-tinted shadow + tracking-tight to ManagerPageShell"
```

---

## Task 2.6: grid-standard-toolbar 디자인 갱신

**Files:**
- Modify: `frontend/src/components/grid/grid-standard-toolbar.tsx`

- [ ] **Step 1: 현재 toolbar 구조 파악**

```bash
cat frontend/src/components/grid/grid-standard-toolbar.tsx
```

- [ ] **Step 2: toolbar 디자인 갱신**

기존 className 패턴을 유지하면서 디자인 토큰 적용:
- 버튼: `rounded-md` 일관, `text-xs font-medium`
- Primary action ("저장"): `bg-primary text-primary-foreground hover:bg-primary-hover`
- Tertiary actions ("행 추가", "삭제", "Excel 다운로드"): `bg-muted text-muted-foreground hover:bg-accent`
- toolbar bottom border: `border-b border-border-soft`

(기존 코드 line 단위로 반복적이라 grep으로 패턴 찾아 일괄 갱신)

- [ ] **Step 3: Lint + Build + validate:grid**

```bash
cd frontend
npm run lint
npm run build
npm run validate:grid
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/grid/grid-standard-toolbar.tsx
git commit -m "feat(grid): apply design tokens to grid toolbar (buttons, border)"
```

---

## Task 2.7: grid-pagination-controls 디자인 갱신

**Files:**
- Modify: `frontend/src/components/grid/grid-pagination-controls.tsx`

- [ ] **Step 1: pagination 디자인 갱신**

- 컨테이너: `bg-muted border-t border-border` (그리드 카드 하단)
- 페이지 번호: `text-xs text-muted-foreground tabular-nums`
- 화살표 버튼: `rounded-md p-1 hover:bg-accent text-muted-foreground` + `<ChevronLeft />` / `<ChevronRight />` (lucide)
- "50개씩 보기" select: `bg-card border border-border text-xs rounded-md`

- [ ] **Step 2: Lint + Build + validate:grid**

```bash
cd frontend
npm run lint
npm run build
npm run validate:grid
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/grid/grid-pagination-controls.tsx
git commit -m "feat(grid): apply design tokens to pagination controls"
```

---

## Task 2.8: Phase 2 검증 + PR

- [ ] **Step 1: 전체 검증**

```bash
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
```

- [ ] **Step 2: Dev에서 사이드바 collapsible + 그리드 페이지 외피 모두 확인**

라이트/다크 + 모바일/데스크톱.

- [ ] **Step 3: PR #2 생성**

```bash
git push
gh pr create --title "feat(layout): common shell — sidebar collapsible, header, grid skin" --body "$(cat <<'EOF'
## Summary
- useSidebarCollapsed hook + localStorage 보존
- 사이드바 Collapsible 토글 (200px ↔ 60px, 데스크톱)
- 모바일 hamburger drawer (Sheet)
- 헤더 73px 갱신 (검색 + 액션 cluster)
- ManagerPageShell + ManagerSearchSection 디자인
- 그리드 toolbar + 페이지네이션 토큰화

## Test plan
- [ ] 사이드바 collapsed 상태 새로고침 후 유지
- [ ] 모바일 viewport(375px)에서 hamburger drawer 정상
- [ ] 그리드 페이지(사원관리, 발령, 부서) 외피 정상
- [ ] \`validate:grid\` PASS

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Phase 3: shadcn/ui 컴포넌트

## Task 3.1: Button — pill variant + tertiary

**Files:**
- Modify: `frontend/src/components/ui/button.tsx`

- [ ] **Step 1: 기존 button.tsx 의 `cva` variants 확인**

```bash
cat frontend/src/components/ui/button.tsx
```

- [ ] **Step 2: pill + tertiary variants 추가**

`cva(... { variants: { variant: { ... } } })` 의 `variant` 객체에 추가:

```ts
pill: "bg-primary text-primary-foreground hover:bg-primary-hover rounded-full px-6 py-3 font-semibold tracking-tight active:scale-[0.98]",
"pill-ghost": "border border-primary text-primary hover:bg-primary-soft rounded-full px-6 py-3 font-semibold tracking-tight active:scale-[0.98]",
tertiary: "bg-muted text-muted-foreground hover:bg-accent rounded-md text-xs font-medium",
```

- [ ] **Step 3: 기본 default variant도 hover/active 갱신**

```ts
default: "bg-primary text-primary-foreground hover:bg-primary-hover rounded-lg active:scale-[0.98] transition-transform",
```

- [ ] **Step 4: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/button.tsx
git commit -m "feat(ui): add pill + tertiary button variants, hover/active states"
```

---

## Task 3.2: Card — radius 12 + Stripe-tinted shadow

**Files:**
- Modify: `frontend/src/components/ui/card.tsx`

- [ ] **Step 1: Card 컴포넌트 className 갱신**

`Card` 컴포넌트의 default className:

```tsx
<div
  className={cn(
    "rounded-xl border border-border bg-card text-card-foreground shadow-[rgba(50,50,93,0.06)_0_4px_12px_-4px,rgba(0,0,0,0.04)_0_2px_6px]",
    className
  )}
  {...props}
/>
```

`CardHeader`, `CardContent`, `CardFooter` 의 padding 갱신:
- `CardHeader`: `flex flex-col space-y-1.5 p-4 md:p-6`
- `CardTitle`: `text-lg font-semibold tracking-tight`
- `CardContent`: `p-4 pt-0 md:p-6 md:pt-0`
- `CardFooter`: `flex items-center p-4 pt-0 md:p-6 md:pt-0`

- [ ] **Step 2: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/card.tsx
git commit -m "feat(ui): apply rounded-xl + Stripe-tinted shadow to Card component"
```

---

## Task 3.3: Input — focus ring + invalid state

**Files:**
- Modify: `frontend/src/components/ui/input.tsx`

- [ ] **Step 1: Input className 갱신**

```tsx
<input
  className={cn(
    "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-sans",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive",
    className
  )}
  {...props}
/>
```

- [ ] **Step 2: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/input.tsx
git commit -m "feat(ui): add focus ring + aria-invalid styling to Input"
```

---

## Task 3.4: Label — required indicator support

**Files:**
- Modify: `frontend/src/components/ui/label.tsx`

- [ ] **Step 1: Label에 required prop 추가**

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-xs font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

- [ ] **Step 2: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/label.tsx
git commit -m "feat(ui): add required prop with asterisk indicator to Label"
```

---

## Task 3.5: Badge — status tones + leading icon

**Files:**
- Modify: `frontend/src/components/ui/badge.tsx`

- [ ] **Step 1: Badge variants 갱신**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-transparent",
        secondary: "bg-secondary text-secondary-foreground border border-transparent",
        outline: "border border-border text-foreground",
        pending: "bg-warning/15 text-warning-foreground border border-warning/25",
        approved: "bg-success/15 text-success-foreground border border-success/25",
        urgent: "bg-destructive/15 text-destructive border border-destructive/25",
        info: "bg-primary-soft text-primary border border-primary/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} role="status" {...props} />;
}

export { Badge, badgeVariants };
```

사용 예시 (Phase 4에서):
```tsx
import { AlertCircle, CheckCircle2, Zap } from "lucide-react";

<Badge variant="pending">
  <AlertCircle size={11} />
  대기
</Badge>
<Badge variant="approved">
  <CheckCircle2 size={11} />
  승인
</Badge>
<Badge variant="urgent">
  <Zap size={11} />
  긴급
</Badge>
```

- [ ] **Step 2: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/badge.tsx
git commit -m "feat(ui): add status badge variants (pending/approved/urgent/info) with role=status"
```

---

## Task 3.6: Phase 3 검증 + PR

- [ ] **Step 1: 전체 검증**

```bash
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
```

- [ ] **Step 2: PR #3**

```bash
git push
gh pr create --title "feat(ui): shadcn components — pill, card, input, badge tokens" --body "$(cat <<'EOF'
## Summary
- Button: pill / pill-ghost / tertiary variants 추가
- Card: rounded-xl + Stripe-tinted shadow
- Input: focus ring + aria-invalid 스타일
- Label: required prop (asterisk)
- Badge: pending/approved/urgent/info variants + role="status"

## Test plan
- [ ] 모든 페이지 버튼/카드/입력 깨짐 없음
- [ ] Badge 색상 + leading icon 정상

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Phase 4: Pages

## Task 4.1: 로그인 페이지 — Apple split + 자연광 사진

**Files:**
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/components/auth/login-card.tsx`
- Create: `frontend/public/images/login-hero.jpg` (Unsplash 다운로드)

- [ ] **Step 1: 자연광 사무실 사진 다운로드**

```bash
cd frontend/public/images
curl -L "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&auto=format&fit=crop&q=80" -o login-hero.jpg
ls -lh login-hero.jpg
```

Expected: ~150KB jpg 파일 생성. 깨지지 않았는지 브라우저로 확인 (`http://localhost:3000/images/login-hero.jpg`).

- [ ] **Step 2: login/page.tsx 갱신 — Split 레이아웃**

`frontend/src/app/login/page.tsx`:

```tsx
import { LoginCard } from "@/components/auth/login-card";

const ERROR_MESSAGES: Record<string, string> = {
  email_required: "소셜 로그인은 이메일 제공 동의가 필요합니다.",
  token_exchange_failed: "소셜 로그인 토큰 교환에 실패했습니다. 다시 시도해 주세요.",
  profile_fetch_failed: "소셜 사용자 정보를 가져오지 못했습니다.",
  invalid_state: "보안 검증에 실패했습니다. 다시 로그인해 주세요.",
  social_exchange_failed: "소셜 계정 로그인 처리에 실패했습니다.",
  missing_code: "소셜 로그인 코드가 누락되었습니다.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const initialErrorMessage = params.error
    ? ERROR_MESSAGES[params.error] ?? "소셜 로그인에 실패했습니다."
    : null;

  return (
    <div className="flex min-h-screen w-full">
      {/* 좌측 hero (md+에서만 보임) */}
      <aside
        className="relative hidden md:flex flex-[1.1] flex-col justify-between p-8 lg:p-12 text-white overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(125deg, rgba(16,21,34,0.86) 0%, rgba(16,21,34,0.55) 55%, rgba(35,43,72,0.45) 100%), url('/images/login-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden="true"
      >
        <div className="text-sm font-bold tracking-wider">VIBE-HR</div>
        <div className="space-y-3">
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tighter">
            사람을 위한
            <br />
            인사 운영
          </h1>
          <p className="text-sm text-white/85 leading-relaxed max-w-sm">
            근태부터 급여, 평가까지 — 직원 한 명의 여정이 한 화면에 흐릅니다.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
          2026 · VIBE-HR SYSTEMS
        </div>
      </aside>

      {/* 우측 form */}
      <main className="flex-1 flex items-center justify-center bg-card p-6 md:p-12">
        <div className="w-full max-w-[420px]">
          <LoginCard initialErrorMessage={initialErrorMessage} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: login-card.tsx 디자인 갱신**

`frontend/src/components/auth/login-card.tsx`의 카드 부분 갱신:
- 헤딩: "로그인" (`text-2xl font-bold tracking-tight`)
- 서브: "계정 정보로 시작하세요" (`text-sm text-muted-foreground`)
- 입력: `<Input>` 컴포넌트 + `<Label required>` 페어 (Phase 3 결과 활용)
- Primary CTA: `<Button variant="pill">로그인</Button>`
- Divider: 흩어진 `또는` 텍스트
- Google 버튼: `<Button variant="pill-ghost">` with Google icon

(기존 login-card 구조 유지하면서 className 갱신)

- [ ] **Step 4: Lint + Build + 시각 확인**

```bash
cd frontend
npm run lint
npm run build
npm run dev
```

`/login` → 데스크톱: split, 모바일: form만 (좌측 hero hidden md:flex로 숨김).

- [ ] **Step 5: Commit**

```bash
git add frontend/public/images/login-hero.jpg frontend/src/app/login/page.tsx frontend/src/components/auth/login-card.tsx
git commit -m "feat(login): Apple-style split layout with self-hosted natural-light hero"
```

---

## Task 4.2: 대시보드 — Stripe Dashboard tone

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`
- 가능한 components: `frontend/src/components/dashboard/*`

- [ ] **Step 1: dashboard/page.tsx 갱신**

기존 대시보드 구조에 맞춰 헤더 + 통계 카드 4개 + 결재 대기 섹션 추가/갱신:

```tsx
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { StatCard } from "@/components/dashboard/stat-card";

export default async function DashboardPage() {
  // 기존 데이터 로딩 로직 유지
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background min-h-[calc(100vh-73px)]">
      {/* 페이지 헤더 */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground">
          대시보드
        </h1>
        <span className="text-xs text-muted-foreground tabular-nums">
          {/* 오늘 날짜 */}
        </span>
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="오늘 출근" value="09:02" trend="정시 출근" trendType="success" />
        <StatCard label="이번달 근무" value="152.5h" trend="+3.2h vs 전월" trendType="success" />
        <StatCard label="잔여 연차" value="8일" trend="한도 47%" trendType="warning" />
        <StatCard label="다음 급여" value="D-3" trend="2026-04-25 입금" trendType="info" />
      </div>

      {/* 대기중 결재 */}
      <ApprovalQueue />
    </div>
  );
}
```

- [ ] **Step 2: StatCard 컴포넌트 생성**

`frontend/src/components/dashboard/stat-card.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

type TrendType = "success" | "warning" | "destructive" | "info";

export function StatCard({
  label,
  value,
  trend,
  trendType = "info",
}: {
  label: string;
  value: string;
  trend?: string;
  trendType?: TrendType;
}) {
  const trendColor = {
    success: "text-success-foreground",
    warning: "text-warning-foreground",
    destructive: "text-destructive",
    info: "text-muted-foreground",
  }[trendType];

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-[rgba(50,50,93,0.06)_0_4px_12px_-4px,rgba(0,0,0,0.04)_0_2px_6px]">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      {trend && (
        <div className={cn("mt-0.5 text-[10px] font-medium tabular-nums", trendColor)}>
          {trend}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: ApprovalQueue 섹션 갱신 (기존 컴포넌트 있다면 className만, 없으면 신규)**

대기중 결재 목록 섹션 (Card + 행 리스트). 기존 코드가 있으면 className 토큰화, 없으면 신규 컴포넌트 만들기.

- [ ] **Step 4: Lint + Build + Dev 확인**

```bash
cd frontend
npm run lint
npm run build
npm run dev
```

`/dashboard` 시각 확인.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx frontend/src/components/dashboard
git commit -m "feat(dashboard): apply Stripe Dashboard tone with stat cards + approval queue"
```

---

## Task 4.3: 소비형 페이지 (내 결재함, 내 신청, 내 급여명세서)

**Files:**
- Modify: `frontend/src/app/hri/tasks/approvals/page.tsx`
- Modify: `frontend/src/app/hri/tasks/receives/page.tsx`
- Modify: `frontend/src/app/hri/requests/mine/page.tsx`
- Modify: `frontend/src/app/hri/my-payslip/page.tsx`

- [ ] **Step 1: 각 페이지 layout 통일**

- 페이지 헤더: H1 + 우측 메타
- 통계/요약 카드 (해당하는 경우)
- 본문 카드 (목록 / 데이터)

각 페이지마다 기존 구조에 맞춰 className 토큰화 + Stripe Dashboard 톤 적용.

- [ ] **Step 2: Status badge 사용 (대기/승인/긴급)**

내 결재함 등 status가 있는 페이지에서 Phase 3의 Badge variants 사용:

```tsx
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Zap } from "lucide-react";

<Badge variant="pending"><AlertCircle size={11} />대기</Badge>
```

- [ ] **Step 3: tabular-nums 적용**

날짜, 금액, 시간 같은 숫자에 `className="tabular-nums"` 또는 `font-feature-settings: tnum`.

- [ ] **Step 4: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
npm run dev
```

각 페이지 시각 확인.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/hri
git commit -m "feat(hri): apply Stripe Dashboard tone to my-tasks/requests/payslip pages"
```

---

## Task 4.4: hardcoded 색상 grep 후 토큰 치환 (전체 페이지)

**Files:**
- 전체 `frontend/src/**/*.tsx`, `frontend/src/**/*.ts`

- [ ] **Step 1: hardcoded 색상 클래스 일괄 검색**

```bash
cd frontend
grep -rn "bg-white\|bg-slate-50\|bg-gray-50\|text-black\|text-gray-9\|text-gray-7\|text-slate-9\|text-slate-7\|text-gray-5\|text-slate-5\|border-gray-2\|border-slate-2" src --include="*.tsx" --include="*.ts" > /tmp/hardcoded-colors.txt
wc -l /tmp/hardcoded-colors.txt
```

결과 라인 수 확인. 50건 미만이면 직접 수정, 50건 이상이면 카테고리별 일괄 치환.

- [ ] **Step 2: 카테고리별 치환 매핑**

| 기존 | 토큰 |
|------|------|
| `bg-white` | `bg-card` |
| `bg-slate-50`, `bg-gray-50` | `bg-muted` |
| `text-black`, `text-gray-900`, `text-slate-900` | `text-foreground` |
| `text-gray-700`, `text-slate-700` | `text-foreground` |
| `text-gray-500`, `text-slate-500` | `text-muted-foreground` |
| `border-gray-200`, `border-slate-200` | `border-border` |
| `border-gray-100`, `border-slate-100` | `border-border-soft` |

각 파일에서 manual replace. (Window/macOS 환경에서 정확히 작동하도록 sed 대신 IDE 또는 Edit tool 사용 권장.)

- [ ] **Step 3: 회귀 시각 검증 (라이트 + 다크)**

```bash
cd frontend
npm run dev
```

각 도메인 대표 페이지 (HR/ORG/TIM/PAYROLL/WEL/HRI/TRA) 라이트/다크 모두 확인.

- [ ] **Step 4: Lint + Build + validate:grid**

```bash
npm run lint
npm run build
npm run validate:grid
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "refactor(theme): replace hardcoded Tailwind colors with semantic tokens"
```

---

## Task 4.5: Phase 4 검증 + PR

- [ ] **Step 1: 전체 검증**

```bash
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
```

- [ ] **Step 2: 모든 메인 페이지 라이트 + 다크 시각 확인**

- [ ] **Step 3: PR #4**

```bash
git push
gh pr create --title "feat(pages): login + dashboard + consumer pages redesign" --body "$(cat <<'EOF'
## Summary
- 로그인: Apple-style split + 자연광 사무실 사진 (self-hosted)
- 대시보드: Stripe Dashboard tone (StatCard 4개 + ApprovalQueue)
- HRI 소비형 페이지: 내 결재함, 내 신청, 내 급여명세서
- hardcoded Tailwind 색상 → 토큰 일괄 치환

## Test plan
- [ ] 로그인 데스크톱(split) + 모바일(form만) 정상
- [ ] 대시보드 통계 카드 + 결재 대기 표시
- [ ] HRI 페이지 status badge + tabular-nums
- [ ] 다크 모드에서 깨진 곳 없음
- [ ] \`validate:grid\` PASS

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Phase 5: Accessibility

## Task 5.1: axe-core + Playwright a11y 테스트 셋업

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tests/a11y/login.spec.ts`
- Create: `frontend/tests/a11y/dashboard.spec.ts`

- [ ] **Step 1: 의존성 설치**

```bash
cd frontend
npm install -D @axe-core/playwright
```

기존 Playwright 설치 여부 확인:
```bash
ls frontend/playwright.config.* 2>/dev/null || echo "Playwright not yet configured"
```

없으면:
```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: 로그인 a11y 테스트**

`frontend/tests/a11y/login.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("@a11y Login page", () => {
  test("WCAG 2.1 AA 준수", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("키보드 navigation: Tab 순서", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab"); // 이메일
    await expect(page.getByLabel("이메일")).toBeFocused();
    await page.keyboard.press("Tab"); // 비밀번호
    await expect(page.getByLabel("비밀번호")).toBeFocused();
    await page.keyboard.press("Tab"); // 로그인 버튼
    await expect(page.getByRole("button", { name: "로그인" })).toBeFocused();
  });
});
```

- [ ] **Step 3: 대시보드 a11y 테스트**

`frontend/tests/a11y/dashboard.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("@a11y Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    // 테스트 사용자 로그인 (실제 프로젝트 auth flow 따름)
    await page.goto("/login");
    // ... auth steps
  });

  test("WCAG 2.1 AA 준수", async ({ page }) => {
    await page.goto("/dashboard");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .exclude(".ag-theme-quartz")  // AG Grid 셀은 외부 lib, 별도 추적
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

- [ ] **Step 4: package.json에 test 스크립트 추가**

```json
"scripts": {
  "test:a11y": "playwright test --grep '@a11y'"
}
```

- [ ] **Step 5: 테스트 실행 (실패 가능)**

```bash
npm run test:a11y
```

Expected: 첫 실행에서 일부 violations 가능. 다음 task에서 수정.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tests/a11y
git commit -m "test(a11y): add axe-core Playwright tests for login + dashboard"
```

---

## Task 5.2: reduced-motion 처리

**Files:**
- Modify: `frontend/src/app/globals.css` (마지막에 추가)

- [ ] **Step 1: globals.css 마지막에 reduced-motion 미디어 쿼리 추가**

```css
/* ============================================================ */
/* Reduced motion — WCAG 2.1 AA                                  */
/* ============================================================ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 3: 시각 검증 (OS reduced-motion 활성화)**

브라우저 devtools → Rendering → Emulate prefers-reduced-motion: reduce → 사이드바 토글 시 즉시 반응 (180ms 대신 0).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(a11y): respect prefers-reduced-motion for all animations"
```

---

## Task 5.3: 그리드 행 status leading marker (color-not-only)

**Files:**
- Modify: `frontend/src/components/grid/grid-change-summary-badges.tsx` (또는 그리드 row status 처리 코드)
- Modify: `frontend/src/app/globals.css:486-526` (`vibe-row-*` 클래스)

- [ ] **Step 1: globals.css에 leading marker 추가**

`vibe-row-added`, `vibe-row-updated`, `vibe-row-deleted` 클래스에 ::before pseudo-element로 marker 추가:

```css
.vibe-grid .vibe-row-added::before {
  content: "● ";
  color: var(--primary);
  font-size: 10px;
  margin-right: 4px;
}
.vibe-grid .vibe-row-updated::before {
  content: "◐ ";
  color: var(--warning);
  font-size: 10px;
  margin-right: 4px;
}
.vibe-grid .vibe-row-deleted::before {
  content: "─ ";
  color: var(--destructive);
  font-size: 10px;
  margin-right: 4px;
}
```

(AG Grid 행 셀에서 ::before가 잘 보이는지 확인. 안 보이면 상태 셀(첫 컬럼) 셀 컴포넌트에 직접 marker render.)

- [ ] **Step 2: Status badge cell renderer가 따로 있다면 거기 마커 추가**

그리드의 status 컬럼 (`vibe-status-added` 등)에서 leading icon 추가.

- [ ] **Step 3: Lint + Build + 시각 확인**

```bash
cd frontend
npm run lint
npm run build
npm run dev
```

사원관리 → 행 추가/수정/삭제 → 색상 + leading marker 모두 표시.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css frontend/src/components/grid
git commit -m "feat(a11y): add leading markers to grid row status (not color-only)"
```

---

## Task 5.4: ARIA labels 일괄 점검 (icon-only 버튼)

**Files:**
- 전체 `frontend/src/**/*.tsx`

- [ ] **Step 1: icon-only 버튼 grep**

```bash
cd frontend
grep -rn "<button" src --include="*.tsx" -A 3 | grep -B 1 "Icon\|<X\|<Bell\|<ChevronLeft\|<ChevronRight\|<Menu\|<Search" | head -30
```

각 결과에서 `aria-label` 속성 있는지 확인. 없으면 추가:

```tsx
<button aria-label="알림"><Bell /></button>
<button aria-label="검색"><Search /></button>
<button aria-label="메뉴 열기"><Menu /></button>
```

- [ ] **Step 2: 사이드바 토글, 헤더 액션, 그리드 toolbar 버튼 우선 점검**

이미 Task 2.2에서 사이드바 토글 `aria-label` 처리. 헤더 (Task 2.4)에서 알림 버튼 등 처리. 추가 누락분 점검.

- [ ] **Step 3: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "fix(a11y): add aria-label to all icon-only buttons"
```

---

## Task 5.5: Skip link + heading hierarchy

**Files:**
- Modify: `frontend/src/components/layout/protected-session-layout.tsx` 또는 `app-shell.tsx`

- [ ] **Step 1: app-shell.tsx 최상단에 skip link 추가**

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
>
  메인 콘텐츠로 건너뛰기
</a>
```

`<main id="main-content">` 또는 ManagerPageShell 컨테이너에 `id="main-content"` 추가.

- [ ] **Step 2: 페이지별 heading hierarchy 점검**

각 페이지에 `<h1>` 1개 + `<h2>` 섹션. AppShell 헤더에는 h1 없음 (페이지가 h1 가짐). 카드 타이틀은 h2/h3 (semantically appropriate).

- [ ] **Step 3: Lint + Build + axe 재실행**

```bash
cd frontend
npm run lint
npm run build
npm run test:a11y
```

Expected: violations 줄어듦.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(a11y): add skip link + h1/h2 hierarchy"
```

---

## Task 5.6: a11y CI 게이트 통합

**Files:**
- Modify: `.github/workflows/ci.yml` (또는 동등한 CI 설정)
- Create: `frontend/playwright.config.ts` (없으면)

- [ ] **Step 1: Playwright config 확인/생성**

`frontend/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

- [ ] **Step 2: CI workflow에 a11y job 추가**

`.github/workflows/` 의 frontend 관련 workflow에 step 추가:

```yaml
- name: Install Playwright browsers
  run: cd frontend && npx playwright install --with-deps chromium
- name: Run a11y tests
  run: cd frontend && npm run test:a11y
```

또는 별도 workflow `.github/workflows/a11y.yml` 생성.

- [ ] **Step 3: Lint + Build**

```bash
cd frontend
npm run lint
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/playwright.config.ts .github/workflows
git commit -m "ci: add Playwright a11y CI gate (axe-core)"
```

---

## Task 5.7: Phase 5 검증 + 최종 PR

- [ ] **Step 1: 전체 검증**

```bash
cd frontend
npm run validate:grid
npm run lint
npm run test
npm run build
npm run test:a11y
```

Expected: 모두 PASS, axe violations 0건.

- [ ] **Step 2: 수동 a11y 검증**

- VoiceOver (macOS) 또는 NVDA (Windows)로 로그인 + 대시보드 + 사원관리 둘러보기
- 키보드만으로 전체 페이지 navigation 가능한지
- reduced-motion 활성 시 모든 transition 즉시
- 다크 모드에서 status, badge, button 모두 명확히 구분

- [ ] **Step 3: PR #5**

```bash
git push
gh pr create --title "feat(a11y): WCAG 2.1 AA — axe CI, reduced-motion, status markers" --body "$(cat <<'EOF'
## Summary
- axe-core Playwright 테스트 (login + dashboard)
- prefers-reduced-motion 처리
- 그리드 행 status leading marker (color-not-only)
- icon-only 버튼 aria-label 일괄 추가
- skip link + heading hierarchy
- a11y CI 게이트 (PR마다 axe 검증)

## Test plan
- [ ] axe violations 0건
- [ ] 키보드만으로 전체 페이지 navigation
- [ ] reduced-motion 활성 시 모든 transition 즉시
- [ ] 스크린리더로 status/badge 인지 가능

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Self-Review

## 1. Spec coverage

| Spec § | Plan task | 상태 |
|--------|-----------|------|
| §0 결정 요약 | 전 phase 분산 | ✓ |
| §1 베이스 | Phase 1 (토큰) + Phase 4 (페이지) | ✓ |
| §2.1~2.3 색상 토큰 (라이트/다크/vivid) | Task 1.3, 1.4, 1.5 | ✓ |
| §2.4 색상 대조비 매트릭스 | 토큰 정의에 격상값 반영 (Task 1.3) | ✓ |
| §2.5 luminance stacking | Task 1.4 (다크 토큰 rgba 전환) | ✓ |
| §3.1~3.3 폰트 + 타이포 스케일 | Task 1.2, 1.7 | ✓ |
| §3.4 한글 letter-spacing 분리 | Task 1.7 | ✓ |
| §4.1~4.6 컴포넌트 그래머 | Phase 3 (3.1~3.5) | ✓ |
| §4.7 Form 패턴 | Task 3.3, 3.4 (Input, Label) + Phase 4 페이지 통합 | ✓ |
| §5.1 로그인 패턴 | Task 4.1 | ✓ |
| §5.2 그리드 페이지 외피 | Phase 2 (2.1~2.7) | ✓ |
| §5.3 소비형 페이지 | Task 4.2, 4.3 | ✓ |
| §6 다크 모드 (`!important` 제거) | Task 1.6 | ✓ |
| §7 반응형 (mobile drawer) | Task 2.3 | ✓ |
| §8 적용 범위 | 전 phase | ✓ |
| §9 리스크 / 단계화 | PR #1~#5 분리 | ✓ |
| §10 거버넌스 (R2 사용자 승인) | 사용자 review gate (이미 통과) | ✓ |
| §11 Resolved | spec 문서에 명시 | ✓ |
| §12 Accessibility (WCAG AA) | Phase 5 (5.1~5.7) | ✓ |
| §13 New Open Q (구현 시 결정) | 구현 중 결정 (collapsed 라벨, 사진 self-host 시점, vivid 차트 색상) | ✓ |

**갭 없음**.

## 2. Placeholder scan

검색: TBD / TODO / fill in / similar to / appropriate error handling. **없음** ✓

## 3. Type/method consistency

- `useSidebarCollapsed` hook: `{ collapsed, toggle, setCollapsed }` 일관 ✓
- `StatCard` props: `label / value / trend / trendType` 일관 ✓
- Badge variants: `pending / approved / urgent / info` Phase 3 + Phase 4 일관 ✓
- Token names: `--primary-hover`, `--primary-soft`, `--success-foreground` 등 spec과 plan 일치 ✓

---

# Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-27-redesign-implementation.md`.**

이번 작업은 **Sonnet 모델로 handoff** 예정입니다. 두 가지 실행 방법:

## 옵션 1 — Subagent-Driven (현재 Opus 세션 유지, 권장)

Opus 메인 세션에서 `executor` subagent (Sonnet)로 task별 dispatch. 각 task가 self-contained라 fresh subagent마다 완전 컨텍스트 가능. 사용자가 phase 사이에 review.

이 옵션을 선택하면: `superpowers:subagent-driven-development` 스킬 사용.

## 옵션 2 — Sonnet 새 세션 (Inline Execution)

새 Claude Code 세션을 Sonnet 모델로 시작. 첫 메시지:

> @docs/superpowers/plans/2026-04-27-redesign-implementation.md 의 Phase 1부터 task별로 진행해줘. `superpowers:executing-plans` 스킬 사용. 각 phase 끝나면 멈추고 검토 받아.

이 옵션을 선택하면: 새 세션이 `superpowers:executing-plans` 스킬 사용. 사용자가 phase 사이에 직접 검토.

**어느 쪽으로 진행하시겠어요?**
