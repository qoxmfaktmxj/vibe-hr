# Vibe-Grid 마이그레이션 로드맵

> AG Grid 래퍼 컴포넌트로 화면당 코드를 500~800줄에서 50~100줄로 줄이는 전략 계획.

## 현황

| 지표 | 현재 |
|------|------|
| AG Grid 화면 수 | 63개 |
| 화면당 평균 코드 | ~500줄 |
| 공유 컴포넌트 수 | 8개 (manager-layout, toolbar, pagination, badges, status 등) |
| 중복 로케일 객체 | 18개 파일에 동일 코드 |
| CRUD 완전 구현 화면 | 25개 (40%) |
| 읽기전용 화면 | 19개 (30%) |

## 목표

```
화면당 코드: 500줄 → 50~100줄
새 화면 추가: ~4시간 → ~30분
공통 버그 수정: N개 파일 → 1개 파일
```

---

## Step 1: VibeGrid API 설계

### 기본 사용법 (CRUD)

```tsx
import { VibeGrid } from "@/components/grid/vibe-grid";

export function EmployeeMasterManager() {
  return (
    <VibeGrid<EmployeeRow>
      registryKey="hr.employee"
      title="사원관리"
      description="직원 정보를 관리합니다."
      columns={employeeColumnDefs}
      searchFields={<EmployeeSearchFields />}
      fetchUrl="/api/employees"
      saveUrl="/api/employees/batch"
      createEmptyRow={() => ({
        employee_no: "",
        display_name: "",
        department_id: null,
        position_title: "",
        hire_date: "",
        employment_status: "active",
        email: "",
        is_active: true,
        password: "",
      })}
      validateRow={(row) => {
        if (!row.display_name || row.display_name.length < 2) return "이름을 입력해주세요.";
        if (!row.department_id) return "부서를 선택해주세요.";
        return null;
      }}
      trackedFields={["display_name", "department_id", "position_title", "hire_date"]}
      defaultColDef={{ sortable: true, resizable: true, filter: false }}
    />
  );
}
```

### 읽기전용

```tsx
<VibeGrid<ReportRow>
  registryKey="tim.reports"
  title="근태 리포트"
  variant="readonly"
  columns={reportColumnDefs}
  searchFields={<ReportSearchFields />}
  fetchUrl="/api/tim/reports"
/>
```

### 워크플로우

```tsx
<VibeGrid<PayrollRunRow>
  registryKey="payroll.runs"
  title="급여 실행"
  variant="workflow"
  columns={runColumnDefs}
  customToolbar={payrollWorkflowToolbar}
  fetchUrl="/api/pay/runs"
/>
```

---

## Step 2: 내부 구조

```
VibeGrid<T>
├── Props 파싱
│   ├── registryKey → grid-screens.json에서 toolbar/profile 조회
│   ├── variant → "crud" | "readonly" | "approval" | "workflow"
│   └── columns/fetchUrl/saveUrl 등
│
├── ManagerPageShell (AG Grid 모듈 제공)
│   ├── ManagerSearchSection
│   │   └── {searchFields} (사용자 제공 JSX)
│   │
│   └── ManagerGridSection
│       ├── headerLeft
│       │   ├── GridPaginationControls (자동)
│       │   ├── 총 건수 (자동)
│       │   └── GridChangeSummaryBadges (자동)
│       ├── headerRight
│       │   └── GridToolbarActions (registryKey에서 자동 생성)
│       └── body
│           └── AgGridReact<T> (자동 설정)
│               ├── rowClassRules (자동)
│               ├── getRowClass (자동)
│               ├── localeText={AG_GRID_LOCALE_KO} (자동)
│               └── onCellValueChanged (자동 상태 추적)
│
├── 내부 상태
│   ├── rows: T[] (SWR 기반 자동 fetch)
│   ├── _status/_original/_prevStatus (자동 관리)
│   ├── page/pageSize/totalCount (자동 페이지네이션)
│   └── saving/loading 플래그
│
├── 내장 핸들러
│   ├── handleQuery → SWR mutate
│   ├── handleCreate → createEmptyRow() 호출
│   ├── handleCopy → 선택 행 복제
│   ├── handleDelete → toggleDeletedStatus
│   ├── handleSave → validateRow + batch POST
│   ├── handleDownload → xlsx 내보내기
│   ├── handleTemplate → 양식 다운로드
│   ├── handleUpload → xlsx 파싱 + 행 추가
│   └── handlePaste → 클립보드 붙여넣기
│
└── DirtyRowConfirmDialog (자동)
```

---

## Step 3: 마이그레이션 순서

### Wave 1: 읽기전용 화면 (19개, 가장 쉬움)
- ReadonlyGridManager를 VibeGrid variant="readonly"로 교체
- 화면당 작업: ~15분
- 예상 총 소요: ~5시간

**대상**: hr.retire.checklist, tim.annual-leave, tim.attendance-status, tim.leave-approval, tim.reports, hri.tasks.*, mng.* (8개), org.dept-history, wel.benefit-types

### Wave 2: 단순 CRUD (17개, 패턴 동일)
- HR admin 7개, TIM 코드 3개, TRA 5개, payroll.codes, payroll.tax-rates
- 화면당 작업: ~30분
- 예상 총 소요: ~9시간

### Wave 3: 필터링 CRUD (8개, 약간 복잡)
- hr.employee, payroll.employee-profiles, payroll.allowance-deduction-items 등
- 화면당 작업: ~1시간
- 예상 총 소요: ~8시간

### Wave 4: 듀얼 그리드 / 복합 (3개, VibeGrid 확장 필요)
- settings.common-codes (그룹+상세 듀얼 그리드)
- org.restructure (계획+항목 듀얼 그리드)
- payroll.runs (4개 탭 중첩 그리드)
- 예외 허용 또는 `VibeGridDual` 변형 고려

---

## Step 4: 필요한 사전 작업

| 작업 | 파일 | 완료 |
|------|------|:---:|
| useReadonlyGridStatus 훅 | `lib/grid/use-readonly-grid-status.ts` | ✅ 완료 |
| 한국어 로케일 공유화 | `lib/grid/ag-grid-locale-ko.ts` | ✅ 완료 |
| validator variant 지원 | `scripts/validate-grid-screens.mjs` | ✅ 완료 |
| VibeGrid 컴포넌트 구현 | `components/grid/vibe-grid.tsx` | ⏳ 미착수 |
| grid-screens.json variant 추가 | `config/grid-screens.json` | ⏳ 미착수 |
| xlsx 공유 유틸리티 | `lib/grid/grid-xlsx-utils.ts` | ⏳ 미착수 |
| batch save 공유 유틸리티 | `lib/grid/grid-batch-save.ts` | ⏳ 미착수 |
| dirty-row dialog 공유화 | `components/grid/grid-dirty-dialog.tsx` | ⏳ 미착수 |

---

## 예상 효과

| 지표 | Before | After |
|------|--------|-------|
| 화면당 코드 | ~500줄 | ~50~100줄 |
| 새 화면 추가 시간 | ~4시간 | ~30분 |
| 공통 버그 수정 범위 | 63개 파일 | 1개 파일 |
| CRUD 테스트 범위 | 화면별 개별 | VibeGrid 1회 |
| 로케일 중복 | 18개 파일 | 0개 (공유) |
| 신규 개발자 학습 곡선 | 높음 | 낮음 (API 문서만) |

---

## 리스크

| 리스크 | 대응 |
|--------|------|
| AG Grid 버전 업그레이드 시 깨짐 | VibeGrid 내부만 수정하면 됨 (장점) |
| 화면별 커스텀 요구사항 증가 | `customToolbar`, `onCellValueChanged` 등 확장 포인트 제공 |
| 듀얼 그리드 화면 대응 | `VibeGridDual` 변형 또는 예외 허용 |
| 마이그레이션 중 기존 화면 깨짐 | Wave별 진행, 각 Wave 후 validate:grid + tsc + build 검증 |
