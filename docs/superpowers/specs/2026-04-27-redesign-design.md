# Vibe-HR 전면 디자인 개편 — 디자인 스펙

> 작성일: 2026-04-27
> 대상 브랜치: `claude/compassionate-villani-2563d4`
> 베이스: Hybrid D — Stripe 정밀 + Linear 다크 luminance + Apple 게이트웨이
> 다크모드: 필수
> 그리드: AG Grid 외피만 변경 (Vibe-Grid 마이그레이션 호환)

---

## 0. 결정 요약 (브레인스토밍 결과)

| 차원 | 결정 |
|------|------|
| 디자인 베이스 | Hybrid D — Stripe(베이스) + Linear(다크) + Apple(로그인) |
| Primary 색상 | Vibe-HR Blue `#3c6dee` 유지 |
| 다크 캔버스 | `#101522` (현재 토큰 유지) |
| 폰트 (한·영 통합) | Pretendard Variable (Inter 제거) |
| 폰트 호스팅 | Self-host (`npm install pretendard` + `next/font/local`) |
| 로그인 레이아웃 | Split (좌 다크 hero + 우 라이트 form) + Apple alternating tile 그래머 |
| 로그인 hero 그래픽 | 자연광 사무실 사진 (Unsplash `photo-1497366216548-37526070297c`, 자유 라이센스 정식 사용) + 다크 그라디언트 오버레이 |
| 그리드 페이지 외피 | Light Sidebar — Stripe Tone (현재 톤 유지 + 새 그래머) |
| 사이드바 토글 | Collapsible — 200px expanded ↔ 60px icon-only (localStorage 보존) |
| 소비형 페이지 | Stripe Dashboard Tone (정보 밀도 높음) |
| `vivid` 팔레트 | 새 디자인 시스템 토큰 구조에 맞춰 갱신 (마젠타+퍼플 톤 유지) |
| AG Grid 셀 | 변경 안 함 — Vibe-Grid가 가져갈 부분 |

---

## 1. 디자인 베이스 — Hybrid D

세 디자인 시스템(Apple / Stripe / Linear) 분석 후 채택한 구성:

- **Stripe (베이스)** — "Dense data, generous chrome" 철학, 보수적 4–8px radius, `tnum` tabular numerals, 4-8px 그림자 시스템. Vibe-HR의 80+개 데이터 그리드 + 카드 구조와 정확히 일치.
- **Linear (다크모드)** — Luminance stacking (`rgba(255,255,255, 0.02 → 0.04 → 0.05)`). 다크 캔버스 위에 surface 단계를 background opacity로 표현. 우리 다크모드 구현이 `!important` 떡칠인 현 상태를 정리.
- **Apple (로그인 게이트웨이)** — Alternating tile 그래머와 980px pill CTA를 로그인 페이지 한 곳에만 차용. "전면 개편" 인상을 확보.

**적용 안 하는 부분**: Apple의 photography-first / low density tile 철학은 80+ 그리드 페이지에 부적합 → 로그인 외엔 사용 안 함. Stripe의 sohne-var는 라이센스 이슈 → Inter로 대체. Linear의 dark-mode-first는 우리 라이트 사용자 친화도 낮음 → 베이스는 라이트, 다크는 동급.

---

## 2. 색상 토큰

### 2.1 라이트 모드

```css
--background: #f6f6f8;       /* 페이지 캔버스 (parchment 느낌) */
--foreground: #111318;       /* 본문 텍스트 */
--card: #ffffff;             /* 카드 surface */
--card-foreground: #111318;
--popover: #ffffff;
--popover-foreground: #111318;

--primary: #3c6dee;          /* Vibe-HR Blue · CTA · 링크 · 액세 */
--primary-foreground: #ffffff;
--primary-hover: #2f5cd8;    /* +hover 단계 */
--primary-soft: #eef4ff;     /* +soft surface (active nav 배경) */

--secondary: #eef2ff;
--secondary-foreground: #1f2937;
--muted: #f1f5f9;
--muted-foreground: #64748b;
--accent: #eff4ff;
--accent-foreground: #1f2937;
--destructive: #cc2936;
--success: #15be53;
--warning: #d97706;

--border: #e2e8f0;           /* 표준 hairline border */
--border-soft: #f1f5f9;      /* 더 약한 divider */
--input: #e2e8f0;
--ring: #3c6dee;             /* focus ring */

/* 사이드바 */
--sidebar: #f8fafc;
--sidebar-foreground: #111318;
--sidebar-primary: #3c6dee;
--sidebar-primary-foreground: #ffffff;
--sidebar-accent: #eff4ff;
--sidebar-accent-foreground: #3c6dee;
--sidebar-border: #e5e7eb;
--sidebar-ring: #3c6dee;

/* 그리드 */
--grid-header-bg: #f8fafc;
--grid-header-border: #e2e8f0;
--grid-header-text: #475569;
--grid-cell-text: #1e293b;
--grid-row-border: #f1f5f9;
--grid-row-hover: #f8fafc;
--grid-row-selected: #eff6ff;
```

### 2.2 다크 모드 (Linear luminance stacking 차용)

```css
--background: #101522;       /* 메인 콘텐츠 캔버스 */
--foreground: #f8fafc;
--card: rgba(255,255,255,0.03);   /* surface 1 — Linear 패턴 */
--card-foreground: #f8fafc;
--popover: #111827;
--popover-foreground: #f8fafc;

--primary: #7a9cec;          /* 다크에서는 더 밝은 톤 */
--primary-foreground: #111827;
--primary-hover: #9fb8ff;
--primary-soft: rgba(60,109,238,0.18);

--secondary: rgba(255,255,255,0.04);
--secondary-foreground: #f8fafc;
--muted: rgba(255,255,255,0.04);
--muted-foreground: #94a3b8;
--accent: rgba(255,255,255,0.05);
--accent-foreground: #f8fafc;
--destructive: #e04551;
--success: #10b981;
--warning: #fbbf24;

--border: rgba(255,255,255,0.08);
--border-soft: rgba(255,255,255,0.05);
--input: rgba(255,255,255,0.08);
--ring: #7a9cec;

/* 사이드바 */
--sidebar: #0f172a;
--sidebar-foreground: #f8fafc;
--sidebar-primary: #7a9cec;
--sidebar-primary-foreground: #0f172a;
--sidebar-accent: rgba(255,255,255,0.06);
--sidebar-accent-foreground: #f8fafc;
--sidebar-border: rgba(255,255,255,0.06);
--sidebar-ring: #7a9cec;

/* 그리드 */
--grid-header-bg: #1e293b;
--grid-header-border: rgba(255,255,255,0.08);
--grid-header-text: #94a3b8;
--grid-cell-text: #e2e8f0;
--grid-row-border: rgba(255,255,255,0.05);
--grid-row-hover: #1b2a45;
--grid-row-selected: #24324e;
```

### 2.3 `vivid` 대안 팔레트 (갱신)

기존 `vivid` 팔레트(마젠타+퍼플+민트 톤)를 새 디자인 시스템 토큰 구조에 맞춰 다시 정의. 기본 blue 팔레트와 동일한 토큰 키마(`--primary`, `--card`, `--border` 등)를 사용하므로 컴포넌트 코드 변경 없이 팔레트만 토글.

**라이트 모드**:
```css
:root[data-palette="vivid"] {
  --background: #f4f4ed;          /* 따뜻한 parchment */
  --foreground: #2a1542;
  --card: #ffffff;
  --card-foreground: #2a1542;
  --popover: #ffffff;
  --popover-foreground: #2a1542;

  --primary: #5e239d;             /* 딥 퍼플 (마젠타 #f61067 → 더 안정적인 퍼플로 정착) */
  --primary-foreground: #ffffff;
  --primary-hover: #4a1c80;
  --primary-soft: #f6e9ff;

  --secondary: #f6e9ff;
  --secondary-foreground: #2a1542;
  --muted: #eef9f4;
  --muted-foreground: #5e239d;
  --accent: #6decaf;              /* 민트 액세 (보조 강조) */
  --accent-foreground: #2a1542;
  --destructive: #d35269;
  --success: #00b58a;
  --warning: #d97706;

  --border: #e4ddee;
  --input: #e4ddee;
  --ring: #5e239d;

  --sidebar: #f9f8fb;
  --sidebar-foreground: #2a1542;
  --sidebar-primary: #5e239d;
  --sidebar-accent: #f6e9ff;
  --sidebar-accent-foreground: #5e239d;
  --sidebar-border: #e4ddee;
}
```

**다크 모드**:
```css
.dark[data-palette="vivid"] {
  --background: #12101d;
  --foreground: #f5f3ff;
  --card: rgba(255,255,255,0.03);    /* Linear luminance 그대로 */
  --card-foreground: #f5f3ff;

  --primary: #a78bfa;                 /* 다크에서는 라이트 라일락 */
  --primary-foreground: #12101d;
  --primary-hover: #c4b5fd;
  --primary-soft: rgba(94,35,157,0.22);

  --secondary: rgba(255,255,255,0.04);
  --muted: rgba(255,255,255,0.04);
  --muted-foreground: #c4b5fd;
  --accent: rgba(109,236,175,0.16);
  --accent-foreground: #f5f3ff;

  --border: rgba(255,255,255,0.08);
  --input: rgba(255,255,255,0.08);
  --ring: #a78bfa;

  --sidebar: #140f24;
  --sidebar-primary: #a78bfa;
  --sidebar-accent: rgba(255,255,255,0.06);
  --sidebar-border: rgba(255,255,255,0.06);
}
```

원칙:
- Primary는 딥 퍼플 `#5e239d`로 정착 (현재 마젠타 `#f61067`은 다소 거친 색이라 백오피스 톤에 부담)
- 그림자/radius/luminance stacking은 본 스펙의 §4·§6 그래머 그대로 (팔레트만 다름)
- 차트 색상도 vivid 톤으로 매핑 (`--chart-1~5`): `#5e239d`, `#a78bfa`, `#6decaf`, `#00b58a`, `#d35269`

### 2.4 Linear luminance stacking 원칙

다크 모드에서 surface elevation은 background luminance 단계로 표현:

| 단계 | 라이트 | 다크 |
|------|--------|------|
| L0 (페이지 캔버스) | `#f6f6f8` | `#101522` |
| L1 (카드) | `#ffffff` | `rgba(255,255,255,0.03)` |
| L2 (hover/active) | `#f8fafc` | `rgba(255,255,255,0.05)` |
| L3 (popover/dropdown) | `#ffffff` + 그림자 | `#111827` + 1px white inset |
| L4 (modal) | `#ffffff` + 큰 그림자 | `#1f2937` + 큰 그림자 |

**원칙**: 다크 모드에서 `!important` 글로벌 오버라이드(`globals.css:271–319`)는 제거. 모든 컴포넌트가 토큰을 직접 참조하도록 정리.

---

## 3. 타이포그래피

### 3.1 폰트 패밀리 (한·영 통합 — Pretendard만 사용)

```css
--font-sans: var(--font-pretendard), 'Pretendard Variable', system-ui,
             -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo',
             'Malgun Gothic', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

- **Pretendard Variable**: 한글 + 라틴(영문) 가변 폰트. 라틴 글리프가 Inter와 metric 호환으로 설계됨 → 영문도 Pretendard로 통일 (Inter 별도 로드 불필요).
- **Inter 제거**: 기존 `next/font/google`의 Inter 로드 제거.
- **시스템 fallback**: Pretendard 로드 실패 시 OS 한글 폰트(`Apple SD Gothic Neo` / `Malgun Gothic`)로 fallback.

**호스팅: Self-host (`next/font/local`)**

설치:
```bash
npm install pretendard
```

`frontend/src/app/layout.tsx`:
```tsx
import localFont from "next/font/local";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
  weight: "100 900",
});

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
```

Self-host 선택 이유: HR 시스템의 사내망 호환, 외부 CDN에 사용자 IP 노출 없음, `next/font/local`이 자동 preload + layout shift 방지, 폰트 버전을 npm으로 관리.

**OpenType features** (전역):
```css
font-feature-settings: "ss01", "ss03";  /* Pretendard 기본 활성화 */
```

숫자 표시(급여/근태/통계 카드/그리드 셀)에는 별도로:
```css
font-feature-settings: "tnum", "ss01", "ss03";
font-variant-numeric: tabular-nums;
```

### 3.2 타이포 스케일

| 역할 | 크기 | 두께 | 트래킹 | 줄높이 | 용도 |
|------|------|------|--------|--------|------|
| Display | 40px | 700 | -1.0px | 1.10 | 로그인/랜딩 hero only |
| H1 | 28px | 700 | -0.7px | 1.20 | 페이지 제목 (사원관리) |
| H2 | 20px | 600 | -0.4px | 1.30 | 섹션 제목 |
| H3 | 17px | 600 | -0.2px | 1.40 | 카드 헤딩 |
| Body Large | 15px | 400 | normal | 1.55 | 소비형 페이지 본문 |
| Body | 14px | 400 | normal | 1.55 | 기본 본문 |
| Body Strong | 14px | 600 | normal | 1.55 | 강조 본문 |
| Caption | 12px | 500 | 0.04em | 1.40 | 라벨, 메타, 칩 |
| Caption Small | 11px | 500 | 0.04em | 1.40 | 보조 라벨 |
| Number Large | 22px | 700 | -0.5px | 1.10 | 통계 카드 큰 숫자 (tnum) |
| Number | 15px | 600 | -0.3px | 1.30 | 일반 숫자 (tnum) |
| Mono | 13px | 500 | normal | 1.50 | ID, 코드, 사번 |

**원칙**:
- 본문은 14px (Tailwind `text-sm`). Apple 17px / Stripe 16px 사이의 절충 — 한글 가독성 + 정보 밀도 균형.
- 헤딩은 weight 600~700, **negative letter-spacing** 필수 (Pretendard tight 그래머).
- weight 500은 **Caption / 라벨**에만. 본문에 500 사용 금지 (Pretendard 500은 어색).
- 숫자가 들어가는 모든 셀/카드/통계에 `tabular-nums`.

### 3.3 AG Grid 셀 (변경 없음)

```css
/* 현재 globals.css의 .vibe-grid 규칙 그대로 유지 */
.vibe-grid .ag-header-cell { font-size: 12px; font-weight: 600; }
.vibe-grid .ag-cell { font-size: 13px; line-height: 34px; }
```
Vibe-Grid 마이그레이션 시 일괄 교체.

---

## 4. 컴포넌트 그래머

### 4.1 버튼

**Primary (기본)**
```
background: var(--primary)              /* #3c6dee */
color: var(--primary-foreground)        /* #ffffff */
border: none
border-radius: 8px                       /* 백오피스 표준 */
padding: 8px 16px (md) / 6px 12px (sm)
font: 14px / 600 / -0.2px
hover: --primary-hover (#2f5cd8)
active: scale(0.98)
focus: 2px solid ring (offset 2px)
```

**Pill Primary (로그인/소비형 페이지 hero CTA에만)**
```
background: var(--primary)
border-radius: 999px                     /* Apple pill */
padding: 12px 24px
font: 14px / 600 / -0.2px
```

**Ghost / Outlined**
```
background: transparent
color: var(--primary)
border: 1px solid var(--primary)
border-radius: 8px (또는 999px - pill 짝일 때)
hover: background rgba(60,109,238,0.05)
```

**Tertiary (toolbar, 미세 액션)**
```
background: var(--muted) / transparent
color: var(--muted-foreground)
border: none
border-radius: 6px
font: 12px / 500
hover: background var(--accent)
```

**Destructive**
```
background: var(--destructive)
color: white
border-radius: 8px
```

### 4.2 카드

**Standard Card**
```
background: var(--card)
border: 1px solid var(--border)
border-radius: 12px                      /* Stripe 8px과 Linear 12px 사이 */
padding: 16px 20px
shadow: rgba(50,50,93,0.06) 0 4px 12px -4px,
        rgba(0,0,0,0.04) 0 2px 6px       /* Stripe 블루 틴트 그림자 */
```

**Featured Card** (대시보드 통계 카드 등)
```
background: var(--card)
border: 1px solid var(--border)
border-radius: 10px
padding: 12px 14px
shadow: rgba(50,50,93,0.06) 0 4px 12px -4px
```

**Hero Tile** (로그인 좌측, 랜딩)
```
background: <photo with linear-gradient overlay>
border-radius: 0                         /* full-bleed */
padding: 28px 32px
```

### 4.3 입력

```
background: var(--card)
border: 1px solid var(--border)
border-radius: 8px                       /* 검색 바는 999px */
padding: 10px 14px (md) / 8px 12px (sm)
font: 14px Pretendard
placeholder: var(--muted-foreground)
focus: border-color var(--ring), 2px ring offset
disabled: background var(--muted), color var(--muted-foreground)
```

### 4.4 배지 / 칩 / 태그

**Status Tag (대기/긴급/승인 등)**
```
display: inline-block
padding: 1px 8px
border-radius: 999px                     /* Linear pill */
font: 11px / 500
border: 1px solid <톤별 0.25 alpha>
background: <톤별 0.12 alpha>
color: <톤별 솔리드 색>
```

색상 토큰:
- Pending(대기): `#d97706` 톤
- Approved(승인): `#15be53` 톤
- Urgent(긴급): `#cc2936` 톤
- Info(정보): `#3c6dee` 톤

### 4.5 그림자 시스템 (Stripe 블루 틴트)

| Level | Treatment | Use |
|-------|-----------|-----|
| L0 | `none` | 페이지 캔버스, 풀-블리드 hero |
| L1 | `rgba(50,50,93,0.06) 0 4px 12px -4px, rgba(0,0,0,0.04) 0 2px 6px` | 표준 카드 |
| L2 | `rgba(50,50,93,0.10) 0 8px 20px -6px, rgba(0,0,0,0.05) 0 4px 10px` | hover 카드, 통계 카드 |
| L3 | `rgba(50,50,93,0.14) 0 16px 32px -8px, rgba(0,0,0,0.06) 0 6px 14px` | popover, dropdown |
| L4 | `rgba(50,50,93,0.18) 0 24px 48px -12px, rgba(0,0,0,0.08) 0 8px 20px` | modal |
| Focus | `0 0 0 2px var(--ring), 0 0 0 4px rgba(60,109,238,0.20)` | keyboard focus |

다크 모드: 그림자는 거의 보이지 않음 → **luminance stacking으로 elevation 표현** (위 §2.4 참조).

### 4.6 Border Radius 스케일

| 토큰 | px | 용도 |
|------|----|------|
| `rounded-sm` | 4px | 미세 칩, 인라인 배지 |
| `rounded-md` | 6px | tertiary 버튼, toolbar 컨트롤 |
| `rounded-lg` | 8px | primary 버튼, 입력 |
| `rounded-xl` | 10px | featured 카드 |
| `rounded-2xl` | 12px | 표준 카드, popover |
| `rounded-3xl` | 18px | 큰 panel, store-style 카드 |
| `rounded-full` | 999px | pill CTA, status 칩, 검색 바, 아바타 |
| `rounded-none` | 0 | 풀-블리드 hero 타일 |

---

## 5. 페이지 패턴

### 5.1 로그인 (Apple-style 게이트웨이)

```
┌─────────────────────────┬───────────────────────┐
│                         │                       │
│   [Photo: 자연광 사무실]  │   로그인              │
│   linear-gradient overlay│   계정 정보로 시작하세요│
│                         │                       │
│   VIBE-HR               │   [이메일]            │
│                         │                       │
│   사람을 위한            │   [비밀번호]          │
│   인사 운영             │                       │
│                         │   ━━━ 로그인 ━━━ (pill)│
│   근태부터 급여까지...   │                       │
│                         │   ─── 또는 ───        │
│                         │                       │
│   2026 · VIBE-HR        │   ⚪ Google로 계속    │
│                         │                       │
│                         │   비밀번호 찾기       │
└─────────────────────────┴───────────────────────┘
   1.1fr (좌측 다크 hero)    1fr (우측 라이트 form)
```

**좌측 hero**:
- background: 자연광 사무실 사진 + `linear-gradient(125deg, rgba(16,21,34,0.86) 0%, rgba(16,21,34,0.55) 55%, rgba(35,43,72,0.45) 100%)`
- 사진: `https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&auto=format&fit=crop&q=80` — Unsplash 자유 라이센스 정식 사용 (자체 자산으로 교체 시 동일 비율/톤 유지 권장). 권장 처리: 빌드 시 `frontend/public/images/login-hero.jpg`로 download → self-host (CDN 의존성 ↓, 첫 로드 빠름).
- 헤드라인: 32px Pretendard 700, letter-spacing -0.9px, line-height 1.12, color `#ffffff`
- 태그라인: 12px / 400, color `rgba(255,255,255,0.85)`

**우측 form**:
- background: `#ffffff`, padding: 32px 36px
- 헤딩: 22px / 700 / -0.5px
- 입력: 11px 14px padding, 8px radius
- Primary CTA: pill (999px radius), 12px 16px padding, 14px / 600
- 소셜 로그인: white pill with 1px hairline border

**다크 모드**: 우측 form만 다크 (`#101522`), 좌측 hero는 항상 사진 + 다크 오버레이로 동일.

**적용 파일**:
- `frontend/src/app/login/page.tsx`
- `frontend/src/components/auth/login-card.tsx`
- 기존 `/images/login-hr-bg.svg` 의존 제거

### 5.2 그리드 페이지 외피 (관리자 - 80+ 페이지)

```
┌───────┬──────────────────────────────────────┐
│       │  🔍 메뉴 검색      알림 설정 아바타   │   ← 헤더 (73px)
│ VIBE  ├──────────────────────────────────────┤
│  -HR  │                                      │
│       │  사원관리                            │   ← 페이지 타이틀
│ HR    │  전 직원의 인사 정보를 관리합니다.    │
│  사원 │                                      │
│  발령 │  ┌──────────────────────────────┐    │
│  퇴직 │  │ [사번][이름][부서][직급] 조회 │    │   ← 검색 카드 (12px radius)
│       │  └──────────────────────────────┘    │
│ ORG   │                                      │
│  부서 │  ┌──────────────────────────────┐    │
│       │  │ 1,247건·변경0건  [+행][삭제][저장]│   │   ← 그리드 toolbar
│ TIM   │  ├──────────────────────────────┤    │
│  근태 │  │ AG GRID (vibe-grid 클래스)    │    │   ← 그리드 본체 (변경 없음)
│       │  │                              │    │
│       │  ├──────────────────────────────┤    │
│       │  │ 50개씩 · 1/25 · ‹ ›           │    │   ← 페이지네이션
│       │  └──────────────────────────────┘    │
└───────┴──────────────────────────────────────┘
  200px           main content
```

**사이드바** (`DashboardSidebar`) — **Collapsible**:
- background: `var(--sidebar)` (`#f8fafc`)
- border-right: `1px solid var(--sidebar-border)`
- 두 가지 폭 모드:
  - **Expanded** (기본, 200px): 카테고리 라벨 + 메뉴 텍스트 + 아이콘
  - **Collapsed** (60px, icon-only): 아이콘만 표시, 메뉴 라벨은 hover tooltip (popover)
- 토글 컨트롤: 사이드바 하단 고정 토글 버튼 (`<<` / `>>` 아이콘) 또는 헤더 좌측 토글 아이콘
- 상태 보존: localStorage 키 `vibe-sidebar-collapsed: "true" | "false"`. 페이지 이동/새로고침에도 유지.
- 전환 애니메이션: `width 180ms ease-out` (텍스트 fade-out 100ms 동시 적용)
- 카테고리 라벨 (HR / ORG / TIM 등):
  - Expanded: 9px / 600 / 0.08em uppercase, color muted
  - Collapsed: 1px hairline divider만 (라벨 숨김)
- nav-item: 11.5px / 500, padding 6px 10px, radius 6px
  - Collapsed 시: 가로 정렬 → 세로 정렬, 아이콘 중앙, padding 12px 0
- active item: background `--sidebar-accent` (`#eff4ff`), color `--primary`
- 다크: background `#0f172a`, active `rgba(60,109,238,0.18)`
- 모바일 (< md, 768px): collapsible과 무관, hamburger drawer (overlay)로 통일

**헤더** (73px 고정):
- background: `var(--card)`, border-bottom 1px hairline
- 검색 바: pill (999px radius) 또는 8px radius, `--muted` background
- 우측: 알림 / 설정 / 아바타 (32x32 circle)

**메인 콘텐츠** (`ManagerPageShell`):
- background: `var(--background)` (`#f6f6f8`)
- padding: 14px 18px (md), 22px 28px (lg)
- gap: 10–12px between cards

**검색 카드** (`ManagerSearchSection`):
- 표준 카드 (12px radius, L1 그림자)
- 헤더: H2 20px / 600
- 본문: 검색 필드 + Primary "조회" 버튼

**그리드 카드**:
- 표준 카드 (12px radius, L1 그림자)
- toolbar (좌: 변경 카운터, 우: 행 추가/삭제/저장 버튼)
- 본체: AG Grid (`.vibe-grid` 클래스, 셀 스타일 그대로)
- 페이지네이션 (하단)

**적용 컴포넌트**:
- `frontend/src/components/layout/app-shell.tsx` (전체 레이아웃)
- `frontend/src/components/dashboard/dashboard-sidebar.tsx` (사이드바)
- `frontend/src/components/grid/manager-layout.tsx` (페이지 셸)
- `frontend/src/components/grid/grid-standard-toolbar.tsx`
- `frontend/src/components/grid/grid-pagination-controls.tsx`
- AG Grid 셀(`vibe-grid`) **변경 안 함** — Vibe-Grid 마이그레이션 시 일괄 교체

### 5.3 소비형 페이지 (대시보드 / 내 결재함 / 내 급여명세서)

**Stripe Dashboard Tone** — 정보 밀도 높음:

```
┌──────────────────────────────────────────────┐
│  대시보드                  2026-04-27 토요일  │   ← H1 + 메타
├──────────────────────────────────────────────┤
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐              │
│  │출근 │  │근무│  │연차│  │급여│              │   ← 통계 카드 4개
│  │9:02│  │152 │  │ 8일│  │D-3 │              │     (tnum, 22px / 700)
│  │정시 │  │+3.2│  │47% │  │425 │              │
│  └────┘  └────┘  └────┘  └────┘              │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ 대기중 결재 (3)            전체 보기 →│    │   ← 섹션 카드
│  ├──────────────────────────────────────┤    │
│  │ 04-26  이영희 휴가 신청   [대기] 처리 │    │
│  │ 04-26  박지훈 출장        [긴급] 처리 │    │
│  │ 04-25  최은서 시간외      [대기] 처리 │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

**원칙**:
- 페이지 타이틀: H1 (28px / 700), 우측에 날짜/메타 (11–12px / muted)
- 통계 카드: 4-column grid (`repeat(4, 1fr)`), 10px radius, L1 그림자, padding 12px 14px
  - 라벨: 10px / 500 / 0.04em uppercase / muted
  - 숫자: 22px / 700 / `tnum` / -0.5px
  - trend: 10px / 500 / success-or-destructive
- 섹션 카드: 12px radius, L1 그림자, padding 12px 14px
  - 헤더: H3 (14px / 600) + 우측 link (11px / primary)
  - 행: grid layout, font 11px, divider `--border-soft`
- Status 태그: pill, 9px / 500, 톤별 색상

**Apple-스러움 차용 안 함**: 매일 보는 화면이라 hero/큰 헤딩보다 데이터 우선.

**적용 페이지**:
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/hri/tasks/approvals/page.tsx`
- `frontend/src/app/hri/tasks/receives/page.tsx`
- `frontend/src/app/hri/requests/mine/page.tsx`
- `frontend/src/app/hri/my-payslip/page.tsx`

---

## 6. 다크 모드

### 6.1 전환 방식

- 사용자 토글 (현재 `theme-settings-popover` 활용)
- `<html class="dark">` 추가/제거 방식 (Tailwind v4 + `@custom-variant dark`)
- 선호도 저장: localStorage + `prefers-color-scheme` fallback

### 6.2 luminance stacking 적용 원칙

**제거 대상** (`frontend/src/app/globals.css` 271–319 라인):
```css
/* 다음 글로벌 오버라이드 모두 제거 */
.dark .bg-white, .dark .bg-slate-50, ... { background-color: var(--card) !important; }
.dark .text-black, .dark .text-gray-900, ... { color: #f1f5f9 !important; }
.dark .border-gray-200, ... { border-color: var(--border) !important; }
.dark input, .dark select, .dark textarea { ... }
.dark .odd\:bg-white:nth-child(odd), ... { ... }
```

**대체**: 모든 컴포넌트가 토큰(`bg-card`, `text-foreground`, `border-border`)을 직접 참조. `bg-white`, `text-gray-900` 같은 lint hardcoded 값 사용 금지.

### 6.3 사이드바 다크 톤

A 결정: 사이드바도 모드 토글 따라감 (라이트일 때 `#f8fafc`, 다크일 때 `#0f172a`).

### 6.4 AG Grid 다크 토큰 매핑

```css
.dark .ag-theme-quartz {
  --ag-background-color: #0f172a;
  --ag-foreground-color: #e2e8f0;
  --ag-header-background-color: #1e293b;
  --ag-header-foreground-color: #cbd5e1;
  --ag-border-color: #334155;
  --ag-row-border-color: rgba(255,255,255,0.05);
  --ag-odd-row-background-color: #0f172a;
  --ag-control-panel-background-color: #111827;
  --ag-selected-row-background-color: #1e3a5f;
  --ag-range-selection-background-color: rgba(60,109,238,0.20);
}
```

**`!important` 떡칠 제거**: 위 변수만 매핑하고, `globals.css:391–453` 라인의 `.dark .ag-theme-quartz .ag-* { ... !important }` 규칙들은 모두 제거 (변수 기반으로 작동하면 충분).

---

## 7. 반응형

### 7.1 브레이크포인트 (Tailwind v4 기본 유지)

| 토큰 | px | 변화 |
|------|----|------|
| sm | 640 | 단일 컬럼 → 2-col 변환 시점 |
| md | 768 | 사이드바 expanded vs hamburger 분기 |
| lg | 1024 | 통계 카드 4-col 활성화 |
| xl | 1280 | 풀 데스크톱 |
| 2xl | 1536 | content lock |

### 7.2 사이드바 collapsing

- ≥ md (768px): **사용자 토글 가능** (Expanded 200px ↔ Collapsed 60px icon-only). 상태 localStorage 보존.
- < md (768px): hamburger drawer (overlay) — 토글과 무관 (모바일은 항상 drawer)
- 라우트 이동 시 상태 유지, 새로고침 시 localStorage에서 복원

### 7.3 통계 카드 grid

- ≥ lg: `grid-cols-4`
- ≥ md: `grid-cols-2`
- < md: `grid-cols-1`

### 7.4 로그인 split

- ≥ md: 좌 hero + 우 form (1.1fr / 1fr)
- < md: stack (hero 위 + form 아래, hero 압축)

---

## 8. 적용 범위 / 비-범위

### 8.1 적용 (변경 O)

**전역 토큰**
- `frontend/src/app/globals.css` — 색상 토큰 / 다크 luminance stacking / `!important` 제거 / 폰트 import / OpenType features

**레이아웃**
- `frontend/src/app/layout.tsx` — `next/font/google` Inter 로드 제거 + `next/font/local`로 Pretendard Variable 추가, `font-sans` 토큰 갱신
- `frontend/src/components/layout/app-shell.tsx` — 사이드바 collapse 상태에 따른 main content margin 토글
- `frontend/src/components/layout/protected-session-layout.tsx`
- `frontend/src/components/layout/session-countdown.tsx` 등 외피

**사이드바 (collapsible 도입)**
- `frontend/src/components/dashboard/dashboard-sidebar.tsx` — Expanded(200px) ↔ Collapsed(60px) 토글, localStorage 보존, hover tooltip(collapsed 모드)
- 토글 상태 관리: 새 hook `useSidebarCollapsed()` 또는 기존 theme-settings에 통합

**그리드 외피** (AG Grid 셀 제외)
- `frontend/src/components/grid/manager-layout.tsx` (`ManagerPageShell`, `ManagerSearchSection`)
- `frontend/src/components/grid/grid-standard-toolbar.tsx`
- `frontend/src/components/grid/grid-pagination-controls.tsx`
- `frontend/src/components/grid/grid-change-summary-badges.tsx`
- `frontend/src/components/grid/search-controls.tsx`

**shadcn/ui 컴포넌트 토큰 매핑**
- `frontend/src/components/ui/button.tsx` (variants에 pill 추가)
- `frontend/src/components/ui/card.tsx` (radius 12, shadow L1)
- `frontend/src/components/ui/input.tsx` (focus ring 갱신)
- `frontend/src/components/ui/badge.tsx` (status 톤 변형 추가)

**페이지**
- `frontend/src/app/login/page.tsx` + `frontend/src/components/auth/login-card.tsx` — Apple-style split
- `frontend/src/app/dashboard/page.tsx` — Stripe Dashboard Tone
- `frontend/src/app/hri/tasks/approvals/page.tsx`, `receives/page.tsx`, `requests/mine/page.tsx`, `my-payslip/page.tsx`

### 8.2 비-범위 (변경 X)

- **AG Grid 셀 내부**: `.vibe-grid` 셀 폰트/사이즈/줄높이/체크박스/인라인 에디터 — Vibe-Grid 마이그레이션이 가져갈 부분
- **백엔드**: 디자인 변경은 프론트만
- **DB / 스키마**: 변경 없음
- **권한 / 메뉴**: 메뉴 데이터 구조 그대로
- **마케팅 페이지** (`frontend/src/app/page.tsx` 루트): 별도 기획 — 이번 범위 아님

### 8.3 의존성 추가

**확정: Self-host (`npm install pretendard` + `next/font/local`)**

```bash
cd frontend
npm install pretendard
```

`package.json`:
```json
{
  "dependencies": {
    "pretendard": "^1.3.9"
  }
}
```

`next/font/local` 설정 (위 §3.1 참조). Inter는 제거 (`next/font/google` import 제거).

**제거 의존성**: `Inter` (next/font/google에서 로드 — Pretendard로 대체).

**선택 이유**: HR 시스템 사내망 호환, 외부 CDN에 IP 노출 없음, `next/font/local` 자동 preload + layout shift 방지, 폰트 버전 npm 관리.

---

## 9. 리스크 / 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 80+ 페이지 일괄 변경 → 회귀 위험 | High | 단계화: 토큰 → 공통 외피 → shadcn/ui → 페이지 순. 각 단계마다 `npm run validate:grid` + `npm run lint` + `npm run build` |
| `!important` 제거 후 다크모드 깨짐 | Med | 다크모드에서 모든 페이지 visual QA. shadcn/ui 토큰 직접 참조 보장 |
| Pretendard 로드 실패 | Low | system font fallback chain 명시 (`-apple-system, Apple SD Gothic Neo, Malgun Gothic`) |
| AG Grid `--ag-*` 토큰 매핑 누락 | Med | `globals.css`에서 라이트/다크 모두 `--ag-*` 풀세트 정의 후 `.vibe-grid` 클래스 그대로 유지 |
| 하드코딩 색상 잔존 (`text-gray-900` 등) | Med | grep으로 hardcoded Tailwind 색상 클래스 일괄 검색 후 토큰으로 치환 |
| Unsplash 이미지 라이센스 문제 | Low | 임시 사용. 최종 배포 전 자체 촬영본/유료 이미지로 교체 |
| 다중 팔레트(`vivid`) + primary tone 시스템과 충돌 | Med | 본 스펙은 기본 팔레트(blue) 기준. `vivid` 팔레트는 별도 작업으로 톤만 새 구조에 맞춰 갱신 |

---

## 10. 거버넌스 / 승인 플로우

본 변경은 `CLAUDE.md` 기준 **R2 (shared contracts / 공통 그리드 외피 변경)** 에 해당하므로 **사용자 명시 승인** 필요.

승인 후 후속:
1. `/impeccable` + `/ui-ux-pro-max` 디자인 점검 (사용자 요청)
2. `superpowers:writing-plans` 스킬로 단계별 구현 플랜 작성
3. 단계별 PR 분리 (토큰 → 외피 → shadcn → 페이지)
4. 각 단계마다 R1 수준의 자체 검증 (`validate:grid` + `lint` + `build`)

---

## 11. Resolved Questions

브레인스토밍 단계에서 모두 결정됨 (사용자 승인):

- [x] **폰트 (한·영 통합)**: Pretendard Variable만 사용 (Inter 제거)
- [x] **폰트 호스팅**: Self-host (`npm install pretendard` + `next/font/local`)
- [x] **로그인 hero 사진**: Unsplash `photo-1497366216548-37526070297c` 자유 라이센스 정식 사용 (자체 자산 교체는 추후 옵션)
- [x] **`vivid` 팔레트**: 새 디자인 시스템 토큰 구조에 맞춰 갱신 (마젠타+퍼플 톤 유지, Primary는 딥 퍼플 `#5e239d`로 정착)
- [x] **사이드바**: Collapsible 도입 (Expanded 200px ↔ Collapsed 60px icon-only, localStorage 보존)

## 12. New Open Questions (구현 시 결정)

- [ ] **사이드바 collapsed 상태에서 카테고리 라벨 표시 방식** — 1px hairline divider만 vs 3-letter abbrev (HR/ORG/TIM)?
- [ ] **로그인 hero 사진 self-host 시점** — 빌드 타임 다운로드 vs 수동 배치
- [ ] **`vivid` 팔레트의 차트 색상 5종** — 본 스펙은 5색 후보 명시했으나 시각 비교 후 미세 조정 가능

---

**End of spec.**
