# VIBE-HR Quiet Depth 디자인 명세

- 날짜: 2026-07-13
- 상태: 디자인 승인, 구현 대기
- 디자인 방향: Quiet Depth
- 구현 위험 등급: R2
- 범위: Frontend only

## 1. 배경

Claude 세션 `6f2a57fe-efdf-4589-870a-2f35742e9f6b`에서 현재 VIBE-HR의 Standard/Vivid, Light/Dark 화면을 실측했다. 기준 스크린샷은 `output/design-review/`에 있다.

관찰된 핵심 문제는 다음과 같다.

- 라이트 모드는 캔버스, 카드, 사이드바의 명도 차가 작아 화면이 평평하다.
- 다크 모드는 카드와 배경의 깊이 차가 부족하고 브랜드 mark 대비가 약하다.
- Vivid 모드는 일반 내비게이션까지 보라색이 적용되어 선택 위계가 약하다.
- 대시보드 차트 막대가 검정색으로 렌더링된다.
- 다크 AG Grid 화면에서 공통 그리드 툴바만 흰색으로 남는다.

사용자는 A+B 범위, Standard와 Vivid 동등 개선, Quiet Depth 방향, 공통 표면 시스템 및 구현 경계를 승인했다.

## 2. 목표와 비목표

### 목표

- 66개 화면의 구조를 유지하면서 공통 토큰과 컴포넌트로 전체 인상을 개선한다.
- Standard/Vivid와 Light/Dark 네 조합에 동일한 깊이 규칙을 적용한다.
- 검정 차트, 다크 그리드 표면, Vivid 과포화, 다크 로고 대비 결함을 수정한다.
- 장시간 사용하는 HR 업무 화면의 가독성과 정보 밀도를 유지한다.

### 비목표

- 대시보드 Bento 재구성 또는 페이지 레이아웃 변경
- API, 인증, 권한, 메뉴, 급여 업무 규칙 또는 데이터 계약 변경
- AG Grid 툴바 순서, 기능 또는 row status 계약 변경
- 신규 패키지 도입
- 화면별 스타일 덮어쓰기 추가

## 3. 디자인 원칙

1. 캔버스는 미세한 tonal glow만 사용하고 장식 패턴은 사용하지 않는다.
2. 카드는 두꺼운 외곽선보다 명도 차와 저강도 그림자로 구분한다.
3. 사이드바는 본문보다 한 단계 깊게 표현한다.
4. 브랜드 색은 활성 상태, 주요 액션, 상태, 차트에 집중한다.
5. Standard와 Vivid는 같은 표면 위계를 공유하고 색온도만 다르게 한다.
6. 다크 모드는 투명 표면의 중첩보다 불투명한 단계형 표면을 우선한다.

## 4. 토큰 인터페이스

기존 theme state 계약은 유지한다.

```ts
type ThemePreferences = {
  darkMode: boolean;
  paletteMode: "default" | "vivid";
  primaryTone: "blue" | "skyblue" | "gray" | "green" | "red";
  chatbotButtonVisible: boolean;
};
```

`document.documentElement`의 `.dark`, `data-palette`, `data-primary-tone` 적용 방식과 localStorage key는 변경하지 않는다.

기존 semantic token의 값을 네 조합에 맞게 조정하고 다음 표면 토큰을 추가한다.

```css
--vibe-canvas-glow;
--vibe-surface-raised;
--vibe-surface-sunken;
--vibe-shadow-card;
--vibe-shadow-floating;
--vibe-border-emphasis;
```

| 조합 | Canvas | Card | Sidebar | Accent |
| --- | --- | --- | --- | --- |
| Standard Light | `#eef3fa` 계열 | `#ffffff` | `#f8fafc` | blue |
| Standard Dark | `#091321` 계열 | `#111e30` | `#0d1a2d` | soft blue |
| Vivid Light | `#f4f3f5` 계열 | `#ffffff` | `#fbfafc` | muted plum |
| Vivid Dark | `#100f18` 계열 | `#1b1723` | `#181321` | soft plum |

정확한 대비값은 구현 시 WCAG AA 검증 결과에 따라 인접 범위에서 조정할 수 있다. 색상 방향과 표면 단계는 변경하지 않는다.

## 5. 컴포넌트 경계

### `frontend/src/app/globals.css`

- 네 테마 조합의 semantic token과 Quiet Depth 표면 토큰을 정의한다.
- body canvas에 저강도 radial glow를 적용한다.
- 일반 텍스트와 내비게이션 텍스트는 중립색으로 유지한다.
- Vivid 강조색은 active/action/chart로 제한한다.

### `frontend/src/components/ui/card.tsx`

- 공통 `Card`가 raised surface와 card shadow를 소비하도록 한다.
- radius와 spacing API는 변경하지 않는다.
- hover가 필요한 개별 카드에 전역 hover motion을 강제하지 않는다.

### `frontend/src/components/layout/app-shell.tsx`

- shell canvas, top header, tab bar의 표면 단계를 분리한다.
- 기존 탭 저장, 탐색, context menu 동작은 변경하지 않는다.

### `frontend/src/components/dashboard/dashboard-sidebar.tsx`

- 일반 메뉴는 중립색, active 메뉴만 palette accent를 사용한다.
- 브랜드 mark는 라이트/다크 모두 대비가 유지되는 전용 컨테이너에 둔다.
- 메뉴 펼침, 스크롤 복원, 프로필 동작은 변경하지 않는다.

### `frontend/src/components/dashboard/dashboard-charts.tsx`

- hex 값인 `--primary`를 `hsl(...)`로 감싸는 잘못된 구성을 제거한다.
- 차트는 `var(--chart-1)` 또는 대응 semantic chart token을 직접 사용한다.
- Recharts 데이터 구조와 tooltip 계약은 변경하지 않는다.

### `frontend/src/components/grid/manager-layout.tsx`

- `ManagerGridSection`의 `bg-white` 하드코딩을 semantic card surface로 교체한다.
- toolbar 구성, 순서, pagination, dirty-row protection에는 손대지 않는다.
- 이 파일은 공통 AG Grid 경로이므로 구현 전 R2 명시 승인이 필요하다.

## 6. 상태 흐름과 실패 처리

```text
ThemePreferences
  -> html class/data attributes
  -> globals.css semantic tokens
  -> Card/AppShell/Sidebar/Chart/Grid shared consumers
  -> all existing screens
```

- 저장된 theme preference가 없거나 유효하지 않으면 기존 normalization과 기본값을 그대로 사용한다.
- 토큰이 누락될 경우 기존 `background`, `card`, `border`, `primary` semantic token이 fallback 역할을 한다.
- 네트워크, API 또는 사용자 데이터 흐름은 변경하지 않으므로 새로운 runtime error UI는 추가하지 않는다.

## 7. 접근성 및 반응형

- 본문 텍스트와 배경은 WCAG AA 대비를 만족해야 한다.
- active 메뉴는 색상 외에도 배경과 font weight로 구분한다.
- focus ring은 기존 `--ring` 계약을 유지한다.
- 1440×900 desktop과 기존 mobile sidebar breakpoint에서 레이아웃 변형이 없어야 한다.
- 한국어 텍스트 렌더링은 CLI 출력이 아닌 실제 브라우저 스크린샷으로 확인한다.
- 애니메이션은 새로 추가하지 않는다. 기존 transition만 유지한다.

## 8. TDD 및 검증

### RED

- 차트 config가 유효한 CSS color token을 직접 사용하는지 검증하는 회귀 테스트를 먼저 추가한다.
- `ManagerGridSection`이 theme-aware surface를 사용하고 `bg-white`를 사용하지 않는지 검증한다.
- 공통 Card가 Quiet Depth surface/shadow contract를 소비하는지 검증한다.

### GREEN

- 토큰 인터페이스를 먼저 추가한다.
- 차트와 Grid의 확인된 결함을 최소 변경으로 수정한다.
- Card, AppShell, Sidebar 순서로 공통 소비자를 연결한다.

### 자동 검증

`frontend`에서 다음 순서로 실행한다.

1. `npm run validate:grid`
2. `npm run test`
3. `npm run lint`
4. `npm run build`

### 브라우저 검증

- Standard Light 대시보드
- Standard Dark 대시보드
- Vivid Light 대시보드
- Vivid Dark 대시보드
- Standard Dark `/payroll/vouchers`
- Vivid Dark `/payroll/vouchers`
- mobile sidebar 1개 조합

각 반복 전후에 visual verdict를 기록하고, 기존 AG Grid 화면 `/payroll/vouchers`를 공통 grid 회귀 화면으로 사용한다.

## 9. 수용 기준

- 네 테마 조합에서 캔버스, 카드, 사이드바가 명확한 3단계 깊이를 가진다.
- Vivid 일반 내비게이션은 중립색이고 active 항목만 강조색이다.
- 대시보드 차트 막대가 검정색이 아니며 palette chart token을 사용한다.
- 다크 AG Grid toolbar와 body가 같은 theme family에 속한다.
- 라이트/다크 브랜드 mark가 배경과 충분한 대비를 가진다.
- 기능, 툴바 순서, 탭, 메뉴, theme preference 동작에 회귀가 없다.
- 필수 자동 검증과 지정 브라우저 검증이 모두 통과한다.

## 10. 승인 및 실행 경계

디자인은 승인됐다. 구현은 공통 AG Grid와 shared UI를 포함하므로 R2 코드 변경이다. 사용자가 R2 구현을 명시적으로 승인하기 전에는 제품 코드를 수정하지 않는다.

