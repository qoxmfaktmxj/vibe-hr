# vibe-hr 성능/UX 개선 실행 계획

> 정적 코드 리뷰 5개 이슈에 대한 실제 코드 검증 결과 및 변경 계획

---

## 이슈별 검증 결과 요약

| # | 이슈 | 코드 확인 결과 | 수정 필요 | 체감 영향 |
|---|------|---------------|----------|----------|
| 1 | DB 페이지네이션 미적용 | **확인됨** — `.all()` 후 파이썬 슬라이스 | O (필수) | ★★★★★ |
| 2 | batch 응답에 전체 직원 목록 포함 | **확인됨** — `list_employees(session)` 재호출 | O (필수) | ★★★★ |
| 3 | AG Grid AllCommunityModule 풀 로드 | **확인됨** — 18개 화면 전부 AllCommunityModule | △ (검토 후) | ★★★ |
| 4 | theme="legacy" + CSV/엑셀 라벨 혼동 | **확인됨** — 18곳 legacy, 라벨 "엑셀 다운로드" → CSV export | O (즉시 가능) | ★★★ |
| 5 | 대시보드 매초 리렌더 + Intl 재생성 | **확인됨** — setInterval 1초 + 매 tick `new Intl.DateTimeFormat` | O (필수) | ★★★★ |

---

## 이슈 1: 백엔드 사원목록 DB 레벨 페이지네이션

### 현재 상태 (확인된 코드)

- `backend/app/services/employee_service.py:112` — `session.exec(stmt.order_by(HrEmployee.id)).all()` 로 **전체 row 로드**
- `employee_service.py:115-118` — 파이썬에서 `rows_all[start:end]` 슬라이스
- `total_count = len(rows_all)` → 전체를 메모리에 올린 뒤 `len()`으로 카운트

### 문제 심각도: **높음**

- HR 시스템은 데이터가 누적되는 특성상 수백~수만 건이 쌓이며, 3-way JOIN(HrEmployee + AuthUser + OrgDepartment) 결과를 전부 Python 객체로 변환하는 비용이 O(N)
- 검색 조건 있을 때도 전체 조회 후 필터링이므로 DB 인덱스 효과 없음

### 변경 계획

**파일:** `backend/app/services/employee_service.py`

```
변경 전:
  rows_all = session.exec(stmt.order_by(HrEmployee.id)).all()
  total_count = len(rows_all)
  if page is not None and limit is not None and limit > 0:
      start = max(0, (page - 1) * limit)
      end = start + limit
      rows = rows_all[start:end]
  else:
      rows = rows_all

변경 후:
  from sqlalchemy import func

  # 1) COUNT 쿼리 — SELECT COUNT(*) FROM (필터된 서브쿼리)
  count_stmt = select(func.count()).select_from(stmt.subquery())
  total_count = session.exec(count_stmt).one()

  # 2) 페이지네이션 적용
  if page is not None and limit is not None and limit > 0:
      offset = max(0, (page - 1) * limit)
      stmt = stmt.offset(offset).limit(limit)

  rows = session.exec(stmt.order_by(HrEmployee.id)).all()
```

**확인 사항:**
- `all=True` 파라미터 전달 시(전체 조회)에는 OFFSET/LIMIT 미적용으로 기존 동작 유지
- API 엔드포인트(`backend/app/api/employee.py`)는 이미 page/limit를 전달하므로 변경 불필요

**테스트:**
- 기존 테스트 `tests/` 경로에 employee list 관련 테스트 통과 확인
- page=1, limit=10 호출 시 SQL에 `OFFSET 0 LIMIT 10` 포함 확인

---

## 이슈 2: batch 응답에서 전체 직원 목록 제거

### 현재 상태 (확인된 코드)

- `employee_service.py:331` — batch 저장 완료 후 `list_employees(session)` 재호출 (전체 직원 로드)
- `employee.py:79` — `EmployeeBatchResponse.employees: list[EmployeeItem]` 포함
- `employee-master-manager.tsx:1130` — 프론트에서 `json.inserted_count/updated_count/deleted_count`만 사용
- `employee-master-manager.tsx:1146` — 직후 `mutateEmployeePage()`로 SWR 재조회 → 응답의 employees는 **사용되지 않음**

### 문제 심각도: **높음**

- batch save는 수십~수백 건을 한 번에 처리하므로, 저장 + 전체 조회의 이중 비용
- 프론트는 응답의 employees를 이미 무시하고 있어 순수 낭비

### 변경 계획

**파일 1:** `backend/app/schemas/employee.py`

```python
# 변경 전
class EmployeeBatchResponse(BaseModel):
    inserted_count: int
    updated_count: int
    deleted_count: int
    employees: list[EmployeeItem]

# 변경 후
class EmployeeBatchResponse(BaseModel):
    inserted_count: int
    updated_count: int
    deleted_count: int
```

**파일 2:** `backend/app/services/employee_service.py` — `batch_save_employees()` 마지막 부분

```python
# 변경 전
employees, _ = list_employees(session)
return EmployeeBatchResponse(
    inserted_count=inserted_count,
    updated_count=updated_count,
    deleted_count=deleted_count,
    employees=employees,
)

# 변경 후
return EmployeeBatchResponse(
    inserted_count=inserted_count,
    updated_count=updated_count,
    deleted_count=deleted_count,
)
```

**파일 3:** `frontend/src/types/employee.ts` — EmployeeBatchResponse 타입에서 employees 필드 제거 (있다면)

**확인 사항:**
- 프론트 `employee-master-manager.tsx:1130`에서 `json.employees`를 참조하는 곳이 없는지 재확인 → 현재 `inserted_count`, `updated_count`, `deleted_count`만 사용 중으로 확인 완료

---

## 이슈 3: AG Grid AllCommunityModule → 선택적 모듈 로드

### 현재 상태 (확인된 코드)

- `ag-grid-shared-modules.ts` — `AllCommunityModule` 단일 사용
- 18개 화면에서 사용 중, 이 중 일부(payroll 4개, tim 3개, mng 2개, hri 1개)는 **각 컴포넌트에서 독자적으로** `ModuleRegistry.registerModules([AllCommunityModule])` 호출
- AG Grid v35.1.0 사용 중

### 판단: **보류 → 번들 분석 후 결정**

- AG Grid Community v35에서 `AllCommunityModule`은 tree-shakeable하도록 개선된 구조
- 실제 번들 증가분을 측정하지 않으면 모듈 분리 효과가 미미할 수 있음
- 모듈 분리 시 18개 화면 전부를 수정해야 하고, 각 화면마다 필요 모듈 조합이 다를 수 있어 regression 위험

### 변경 계획 (단계적)

**1단계 — 즉시 수정 (중복 등록 제거)**
- payroll 4개, tim 3개, mng 2개, hri 1개에서 `ModuleRegistry.registerModules([AllCommunityModule])` 직접 호출 제거
- 이미 `AgGridModulesProvider`가 상위에서 제공하므로 중복 등록은 불필요한 초기화 비용

해당 파일 목록:
- `frontend/src/components/payroll/payroll-tax-rate-manager.tsx`
- `frontend/src/components/payroll/payroll-code-manager.tsx`
- `frontend/src/components/payroll/pay-item-group-manager.tsx`
- `frontend/src/components/payroll/pay-allowance-deduction-manager.tsx`
- `frontend/src/components/tim/work-schedule-manager.tsx`
- `frontend/src/components/tim/holiday-manager.tsx`
- `frontend/src/components/tim/attendance-code-manager.tsx`
- `frontend/src/components/mng/mng-simple-grid.tsx`
- `frontend/src/components/mng/company-manager.tsx` (확인 필요)
- `frontend/src/components/hri/hri-application-hub.tsx`

**2단계 — 번들 분석 후 (별도 작업)**
- `next build` + `@next/bundle-analyzer`로 ag-grid 비중 측정
- 비중이 유의미하면(예: 100KB+ gzip) 필요 모듈만 선별 등록으로 전환

---

## 이슈 4: theme="legacy" 통일 + CSV/엑셀 라벨 수정

### 현재 상태 (확인된 코드)

- 18개 파일에서 `theme="legacy"` 사용
- `common-code-manager.tsx:447` — 버튼 라벨 "엑셀 다운로드"인데 실제 동작은 `exportDataAsCsv()`
- `common-code-manager.tsx:381` — `onDownload`에서도 `exportDataAsCsv()`인데 파일명은 `group-codes.csv`로 올바름

### 문제 심각도: **중간**

- theme="legacy"는 AG Grid v35에서 v32 이전 스타일 호환 모드 — 현대 테마(quartz)와 CSS 변수 미지원으로 디자인 토큰 일관성 저하
- "엑셀 다운로드" 라벨이 CSV를 반환하면 사용자 혼란 (기대: .xlsx, 실제: .csv)

### 변경 계획

**4-A: CSV 라벨 수정 (즉시 가능)**

**파일:** `frontend/src/components/settings/common-code-manager.tsx:447`

```
변경 전: >엑셀 다운로드</Button>
변경 후: >CSV 다운로드</Button>
```

**4-B: theme="legacy" 제거 (단계적)**

AG Grid v35에서 `theme="legacy"`를 제거하면 기본 테마(quartz built-in)가 적용됨.
이미 `className="ag-theme-quartz"`를 wrapper div에 지정하고 있으므로, `theme="legacy"` prop만 제거하면 quartz 테마로 전환.

**영향 범위:** 18개 파일 — 일괄 수정 가능하지만 각 화면의 시각적 차이를 확인해야 함

**실행 방식:**
1. 먼저 1개 화면(common-code-manager)에서 `theme="legacy"` 제거하고 시각 확인
2. 문제 없으면 나머지 17개 화면 일괄 적용
3. legacy 전용 CSS가 있다면 제거

---

## 이슈 5: 대시보드 출퇴근 패널 매초 리렌더 최적화

### 현재 상태 (확인된 코드)

- `dashboard-attendance-panel.tsx:70-73` — `setInterval(1000)`으로 매초 `setClock(getKoreaDateTime())` 호출
- `getKoreaDateTime()`(12-28행) — 매 호출마다 `new Intl.DateTimeFormat("ko-KR", {...}).formatToParts(now)` 실행
- `fmtTimeOnly()`(36-43행) — 출퇴근 시간 표시에도 매번 새 `Intl.DateTimeFormat` 생성 (이건 data 변경 시에만 호출되므로 상대적으로 무해)
- 컴포넌트가 대시보드 내에 직접 렌더링되어, 매초 state 변경이 부모까지 영향 가능

### 문제 심각도: **높음**

- `Intl.DateTimeFormat` 생성은 locale + timeZone 파싱이 포함된 무거운 연산
- 매 1초마다 생성 → 1분에 60회 → 대시보드에 다른 차트/카드가 있을수록 연쇄 리렌더

### 변경 계획

**파일:** `frontend/src/components/dashboard/dashboard-attendance-panel.tsx`

```tsx
// 변경 전 (함수 최상위)
function getKoreaDateTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `...`;
}

// 변경 후 — 포매터를 모듈 레벨 싱글턴으로 추출
const koreaDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function getKoreaDateTime() {
  const parts = koreaDateTimeFormatter.formatToParts(new Date());
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")} (${pick("weekday")}) ${pick("hour")}:${pick("minute")}:${pick("second")}`;
}
```

동일하게 `fmtTimeOnly`의 포매터도 모듈 레벨 싱글턴으로 추출:

```tsx
const koreaTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function fmtTimeOnly(value: string | null) {
  if (!value) return "-";
  return koreaTimeFormatter.format(parseUtcDate(value));
}
```

**추가:** 시계 컴포넌트를 `React.memo`로 분리하여 대시보드 전체 리렌더 방지

```tsx
const ClockDisplay = React.memo(function ClockDisplay() {
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    setClock(getKoreaDateTime());
    const timer = window.setInterval(() => setClock(getKoreaDateTime()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <p className="font-mono text-lg font-semibold tracking-wide">{clock || "\u00a0"}</p>;
});
```

---

## 실행 우선순위 및 일정

| 순서 | 작업 | 예상 변경 파일 수 | 위험도 |
|------|------|------------------|--------|
| **1** | 이슈 5: Intl 싱글턴 + 시계 분리 | 1개 | 낮음 |
| **2** | 이슈 2: batch 응답 employees 제거 | 3개 (백엔드 2 + 프론트 타입 1) | 낮음 |
| **3** | 이슈 4-A: CSV 라벨 수정 | 1개 | 없음 |
| **4** | 이슈 1: DB 페이지네이션 | 1개 | 중간 (쿼리 변경) |
| **5** | 이슈 3-1단계: 중복 모듈 등록 제거 | ~10개 | 낮음 |
| **6** | 이슈 4-B: theme="legacy" 제거 | 18개 | 중간 (UI 회귀 확인 필요) |

> 순서는 "위험 낮고 체감 큰 것"부터 진행하도록 배치
> 이슈 3 2단계(모듈 분리)와 이슈 4-B(theme 통일)은 시각 회귀 테스트가 필요하므로 별도 PR 권장
