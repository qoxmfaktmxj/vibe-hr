# Vibe-HR 리팩토링 상세 구현 계획

> 작성일: 2026-02-27
> 대상: 프론트엔드 성능 최적화 + 대시보드 UX 개선

---

## 목차
1. [#1 AG Grid 모바일 분기 제거](#1-ag-grid-모바일-분기-제거)
2. [#2 setTimeout + redrawRows 안티패턴 제거](#2-settimeout--redrawrows-안티패턴-제거)
3. [#5 대시보드 차트 Recharts 도입](#5-대시보드-차트-recharts-도입)

---

## #1 AG Grid 모바일 분기 제거

### 배경
e-HR 시스템은 데스크톱 전용이므로 모바일 카드 뷰를 유지할 필요 없음.
CSS `md:hidden` / `hidden md:flex`로 양쪽 모두 렌더링하면 AG Grid가 모바일에서도 메모리에 로드됨.

### 대상 파일 (2개)

#### 파일 1: `frontend/src/components/hr/employee-master-manager.tsx`

| 항목 | 위치 | 작업 |
|------|------|------|
| `mobileRows` 변수 | Line 992 | **삭제** - `const mobileRows = filteredRows;` |
| 모바일 카드 블록 | Lines 1180-1266 | **삭제** - `{/* 모바일 카드 영역 */}` 부터 닫는 `</div>` 까지 |
| AG Grid 래퍼 클래스 | Line 1269 | **수정** - 반응형 클래스 제거 |

```diff
- {/* 모바일 카드 영역 */}
- <div className="flex-1 overflow-auto px-3 pb-4 pt-2 md:hidden">
-   ... (86줄 삭제)
- </div>
-
- {/* AG Grid (데스크톱) */}
- <div className="hidden min-h-0 flex-1 px-3 pb-4 pt-2 md:flex md:flex-col md:px-6 md:pt-0">
+ <div className="min-h-0 flex-1 px-6 pb-4">
```

#### 파일 2: `frontend/src/components/hri/hri-application-hub.tsx`

| 항목 | 위치 | 작업 |
|------|------|------|
| 모바일 카드 블록 | Lines 1172-1199 | **삭제** - `{/* 모바일 카드 */}` 전체 |
| AG Grid 래퍼 클래스 | Line 1150 | **수정** - 반응형 클래스 제거 |

```diff
- {/* 데스크탑 AG Grid */}
- <div className="hidden min-h-0 flex-1 px-3 pb-4 md:block md:px-6">
+ <div className="min-h-0 flex-1 px-6 pb-4">
    <div className="ag-theme-quartz vibe-grid ...">
      <AgGridReact ... />
    </div>
  </div>
-
- {/* 모바일 카드 */}
- <div className="flex-1 overflow-auto px-3 pb-4 pt-2 md:hidden">
-   ... (27줄 삭제)
- </div>
```

### 검증
- 빌드 오류 없는지 확인
- 데스크톱에서 그리드 정상 표시 확인

---

## #2 setTimeout + redrawRows 안티패턴 제거

### 배경
`setTimeout(redrawRows, 0)` 패턴이 **14개 파일, 총 59회** 사용 중.
React의 `rowData` 바인딩을 거스르며 깜빡임(flickering)과 불필요한 전체 행 재렌더링을 유발.

### 현황 전체 목록

| # | 파일 경로 | 함수명 | 호출 횟수 |
|---|----------|--------|----------|
| 1 | `hr/employee-master-manager.tsx` | `refreshGridRows` | 7 |
| 2 | `hr/hr-admin-record-manager.tsx` | `redrawRows` | 5 |
| 3 | `hr/hr-appointment-code-manager.tsx` | `redrawRows` | 5 |
| 4 | `hr/hr-appointment-record-manager.tsx` | `redrawRows` | 5 |
| 5 | `org/organization-manager.tsx` | `refreshGridRows` | 5 |
| 6 | `pap/pap-appraisal-manager.tsx` | `redrawRows` | 5 |
| 7 | `tim/attendance-code-manager.tsx` | `redraw` | 4 |
| 8 | `tim/work-schedule-manager.tsx` | `redraw` | 4 |
| 9 | `tim/holiday-manager.tsx` | `redraw` | 3 |
| 10 | `payroll/payroll-tax-rate-manager.tsx` | `redraw` | 4 |
| 11 | `payroll/pay-item-group-manager.tsx` | `redraw` | 4 |
| 12 | `payroll/pay-allowance-deduction-manager.tsx` | `redraw` | 4 |
| 13 | `payroll/payroll-code-manager.tsx` | `redraw` | 4 |
| **합계** | | | **59회** |

### 왜 redrawRows가 필요했는가

모든 파일이 `getRowClass`를 사용하여 `_status` 필드 기반 행 스타일링을 적용 중:
```typescript
// lib/grid/grid-status.ts
export function getGridRowClass(status?: GridStatus): string {
  if (status === "added") return "vibe-row-added";     // 신규 행: 파란 배경
  if (status === "updated") return "vibe-row-updated"; // 수정 행: 노란 배경
  if (status === "deleted") return "vibe-row-deleted"; // 삭제 행: 빨간 배경
  return "";
}
```

`_status`가 바뀌면 `getRowClass`가 재평가되어야 하는데, AG Grid는 `rowData` 변경 시
셀 값은 자동 갱신하지만 **행 CSS 클래스는 자동 재평가하지 않음**.
그래서 `redrawRows()`로 전체 행을 강제 재렌더링한 것.

### 해결 전략

`redrawRows()` (전체 행 DOM 재생성) 대신 `refreshCells({ force: true })`를 사용.
이는 기존 DOM을 유지하면서 셀 스타일만 갱신하므로 깜빡임이 없고 훨씬 가볍다.

단, AG Grid에서 **행 클래스(`getRowClass`) 재평가**는 `redrawRows`로만 가능하므로,
`getRowClass` 대신 **`cellClass` 기반 스타일링**으로 전환하는 방법을 사용.

> **참고**: 일부 파일(payroll, tim 등)은 이미 `cellClass` 패턴을 사용 중.
> 행 전체가 아닌 각 셀의 클래스로 스타일을 적용하면 `refreshCells({ force: true })`로 충분.

### 구현 단계

#### Step 1: 공통 유틸 수정 (`lib/grid/grid-status.ts`)

기존 `getGridRowClass` 유지 (하위 호환) + `cellClass` 기반 접근 권장 문서화.

#### Step 2: 각 파일 일괄 수정 (13개 파일)

**패턴 A** — `getRowClass` 를 사용하는 파일 (7개):
- employee-master-manager, hr-admin-record-manager, organization-manager
- hr-appointment-code-manager, hr-appointment-record-manager, pap-appraisal-manager
- attendance-code-manager

```diff
  // Before: 함수 정의
- const redrawRows = useCallback(() => {
-   if (!gridApiRef.current) return;
-   gridApiRef.current.redrawRows();
- }, []);

  // After: 경량 스타일 갱신
+ const refreshRowStyles = useCallback(() => {
+   gridApiRef.current?.redrawRows();
+ }, []);

  // Before: 호출부 (모든 곳)
- setTimeout(redrawRows, 0);

  // After: setTimeout 제거, 직접 호출
+ refreshRowStyles();
```

**핵심**: `setTimeout` wrapper를 제거하고 동기 호출로 변경.
React 18+의 자동 배칭(automatic batching) 덕분에 상태 업데이트 직후
`redrawRows`를 동기 호출해도 React가 배치 처리하므로 깜빡임이 없음.

**패턴 B** — `cellClass` 를 사용하는 파일 (6개, payroll + tim):
- payroll-tax-rate-manager, pay-item-group-manager, pay-allowance-deduction-manager
- payroll-code-manager, work-schedule-manager, holiday-manager

```diff
  // Before
- const redraw = useCallback(() => {
-   if (!gridApiRef.current) return;
-   gridApiRef.current.redrawRows();
- }, []);

  // After
+ const refreshRowStyles = useCallback(() => {
+   gridApiRef.current?.refreshCells({ force: true });
+ }, []);

  // Before: 호출부
- setTimeout(redraw, 0);

  // After
+ refreshRowStyles();
```

이 파일들은 `cellClass` 기반이므로 `refreshCells({ force: true })`가
`redrawRows()`보다 가볍고 깜빡임 없이 작동.

#### Step 3: 수정 후 검증 체크리스트

각 파일별로 다음 시나리오 확인:
- [ ] 행 추가 시 파란색(added) 스타일 정상 적용
- [ ] 셀 편집 시 노란색(updated) 스타일 정상 적용
- [ ] 행 삭제 체크 시 빨간색(deleted) 스타일 정상 적용
- [ ] 깜빡임(flickering) 없이 부드러운 전환
- [ ] CSV/Excel 업로드 후 스타일 정상 적용

---

## #5 대시보드 차트 Recharts 도입

### 라이브러리 선정 결과

| 항목 | Recharts | Tremor |
|------|----------|--------|
| **라이선스** | **MIT** ✅ | Apache 2.0 ❌ |
| **번들** | ~60KB gzipped | ~150KB+ |
| **shadcn/ui 통합** | **공식 차트 기반** | 별도 생태계 |
| **npm 주간 DL** | 7,100,000 | 100,000 |

**결론: Recharts** (shadcn/ui chart 래퍼 사용)

### 현재 대시보드 구조 (`app/dashboard/page.tsx`)

```
DashboardPage (Server Component, async)
├── getDashboardSummary() — 서버에서 데이터 fetch
├── Section 1: 오늘 출근 현황
│   ├── DashboardAttendancePanel (Client, compact)
│   └── Card: 출근 현황
│       ├── 3개 수치 박스 (정상/지각/결근)
│       └── 3개 CSS 프로그레스 바 ← 유지 (단순해서 차트 불필요)
└── Section 2: 추이 차트
    ├── Card: 최근 7일 출근 추이 ← SVG 하드코딩 → Recharts AreaChart
    └── Card: 대기 휴가 건수 추이 ← CSS 바 → Recharts BarChart
```

### 구현 단계

#### Step 1: 의존성 설치

```bash
npx shadcn@latest add chart    # recharts + ChartContainer/ChartTooltip 래퍼
```

설치 결과:
- `recharts` 패키지 추가 (package.json)
- `frontend/src/components/ui/chart.tsx` 생성 (shadcn/ui 래퍼)

#### Step 2: 차트 클라이언트 컴포넌트 생성

**파일**: `frontend/src/components/dashboard/dashboard-charts.tsx`

```typescript
"use client";

import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, XAxis, YAxis,
} from "recharts";
import {
  ChartConfig, ChartContainer,
  ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";

// ── 출근 추이 (Area Chart) ──
interface AttendanceTrendProps {
  data: { day: string; count: number }[];
}

const attendanceConfig = {
  count: { label: "출근", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

export function AttendanceTrendChart({ data }: AttendanceTrendProps) {
  return (
    <ChartContainer config={attendanceConfig} className="h-56 w-full">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" fontSize={12} />
        <YAxis fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--color-count)"
          fill="var(--color-count)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ── 휴가 추이 (Bar Chart) ──
interface LeaveTrendProps {
  data: { day: string; count: number }[];
}

const leaveConfig = {
  count: { label: "건수", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

export function LeaveTrendChart({ data }: LeaveTrendProps) {
  return (
    <ChartContainer config={leaveConfig} className="h-56 w-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" fontSize={12} />
        <YAxis fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
```

#### Step 3: 대시보드 페이지 수정 (`app/dashboard/page.tsx`)

```diff
+ import { AttendanceTrendChart, LeaveTrendChart } from "@/components/dashboard/dashboard-charts";

  // 데이터 변환 (서버에서 처리)
  const attendanceTrend = [...];  // 기존 배열 유지
  const leaveTrend = [...];       // 기존 배열 유지

+ const attendanceChartData = attendanceTrend.map((value, idx) => ({
+   day: `D-${attendanceTrend.length - idx - 1}`,
+   count: value,
+ }));
+
+ const leaveChartData = leaveTrend.map((value, idx) => ({
+   day: `D-${leaveTrend.length - idx - 1}`,
+   count: value,
+ }));

  // 차트 섹션
  <Card>
    <CardHeader>
      <CardTitle className="text-base">최근 7일 출근 추이 (샘플)</CardTitle>
    </CardHeader>
    <CardContent>
-     <svg viewBox="0 0 700 220" className="h-56 w-full" ...>
-       {attendanceTrend.map(...)}
-       {attendanceTrend.slice(1).map(...)}
-     </svg>
+     <AttendanceTrendChart data={attendanceChartData} />
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle className="text-base">대기 휴가 건수 추이 (샘플)</CardTitle>
    </CardHeader>
    <CardContent>
-     <div className="space-y-2">
-       {leaveTrend.map(...)}
-     </div>
+     <LeaveTrendChart data={leaveChartData} />

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <!-- 전체 인원 / 부서 수 박스는 유지 -->
      </div>
    </CardContent>
  </Card>
```

### 개선 효과

| 항목 | Before (SVG 하드코딩) | After (Recharts) |
|------|----------------------|-------------------|
| 툴팁 | 없음 | 마우스 호버 시 수치 표시 |
| 반응형 | viewBox 고정 | ResponsiveContainer 자동 리사이즈 |
| 애니메이션 | 없음 | 진입 애니메이션 |
| 접근성 | aria-label만 | 키보드 네비게이션 |
| 코드량 | SVG 좌표 계산 14줄 | 선언적 컴포넌트 10줄 |
| 테마 | hsl 하드코딩 | CSS 변수 자동 연동 (다크모드 대응) |

---

## 실행 순서 및 예상 영향

| 순서 | 작업 | 파일 수 | 변경 성격 |
|------|------|---------|----------|
| 1 | #1 모바일 분기 제거 | 2개 | 코드 삭제 (안전) |
| 2 | #2 setTimeout 제거 | 13개 | 동작 변경 (검증 필요) |
| 3 | #5 Recharts 차트 | 3개 (신규1 + 수정1 + ui1) | 기능 교체 |

### 의존성 관계
- #1과 #2는 독립적 → 병렬 진행 가능
- #5는 독립적 → 언제든 진행 가능
- 세 작업 모두 백엔드 변경 없음

### 롤백 전략
- 각 작업을 별도 커밋으로 분리
- 문제 발생 시 개별 커밋 revert 가능
