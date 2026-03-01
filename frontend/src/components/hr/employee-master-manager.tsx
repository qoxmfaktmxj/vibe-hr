"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Plus,
  Copy,
  FileDown,
  Upload,
  Download,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  type CellValueChangedEvent,
  type ICellRendererParams,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellEditorParams,
  type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { buildEmployeeBatchPayload } from "@/lib/hr/employee-batch";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import { clearSavedStatuses, reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { SEARCH_PLACEHOLDERS } from "@/lib/grid/search-presets";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import type { ActiveCodeListResponse } from "@/types/common-code";
import type {
  EmployeeBatchResponse,
  DepartmentItem,
  EmployeeItem,
} from "@/types/employee";
import type { TimHolidayListResponse } from "@/types/tim";

/* AG Grid modules are provided by ManagerPageShell via AgGridModulesProvider. */

/* ------------------------------------------------------------------ */
/* 타입 정의                                                           */
/* ------------------------------------------------------------------ */
type RowStatus = GridRowStatus;
type ActiveFilter = "" | "Y" | "N";
type SearchFilters = {
  employeeNo: string;
  name: string;
  department: string;
  positions: string[];
  hireDateTo: string;
  employmentStatuses: EmployeeItem["employment_status"][];
  active: ActiveFilter;
};

type EmployeePageResponse = {
  employees: EmployeeItem[];
  total_count: number;
};

type EmployeeGridRow = EmployeeItem & {
  password: string;
  _status: RowStatus;
  /** 원복 판정을 위한 원본 필드 스냅샷 */
  _original?: Record<string, unknown>;
  /** 삭제 처리 전 상태(삭제 해제 시 복구용) */
  _prevStatus?: RowStatus;
};

type PendingReloadAction =
  | { type: "page"; page: number }
  | { type: "query"; filters: SearchFilters };

type EmployeeMasterViewState = {
  rows: EmployeeGridRow[];
  searchFilters: SearchFilters;
  appliedFilters: SearchFilters;
  page: number;
  totalCount: number;
  tempId: number;
  syncedPageKey: string | null;
};

type CommonCodeOption = { code: string; name: string };
let cachedEmployeeMasterViewState: EmployeeMasterViewState | null = null;

const FALLBACK_EMPLOYMENT_OPTIONS: Array<{ code: EmployeeItem["employment_status"]; name: string }> = [
  { code: "active", name: "재직" },
  { code: "leave", name: "휴직" },
  { code: "resigned", name: "퇴직" },
];

const EMPTY_SEARCH_FILTERS: SearchFilters = {
  employeeNo: "",
  name: "",
  department: "",
  positions: [],
  hireDateTo: "",
  employmentStatuses: [],
  active: "",
};

/* ------------------------------------------------------------------ */
/* 다국어 문구                                                         */
/* ------------------------------------------------------------------ */
const I18N = {
  loading: "사원 데이터를 불러오는 중...",
  loadEmployeeError: "사원 목록을 불러오지 못했습니다.",
  loadDepartmentError: "부서 목록을 불러오지 못했습니다.",
  initError: "초기 로딩에 실패했습니다.",
  saveDone: "저장이 완료되었습니다.",
  saveFailed: "저장에 실패했습니다.",
  deleteFailed: "삭제에 실패했습니다.",
  validationError: "입력 값을 확인해 주세요. 필수 입력이 비어 있습니다.",
  statusClean: "",
  statusAdded: "입력",
  statusUpdated: "수정",
  statusDeleted: "삭제",
  noRows: "사원 데이터가 없습니다.",
  requiredName: "이름은 2자 이상 필수입니다.",
  requiredDepartment: "부서를 선택해야 합니다.",
  requiredPosition: "직책은 필수입니다.",
  savePartial: "일괄 저장은 완료되었지만 일부 행이 실패했습니다.",
  title: "사원관리",
  searchPlaceholder: "사번 / 이름 / 부서 검색",
  query: "조회",
  addRow: "입력",
  copy: "복사",
  templateDownload: "양식 다운로드",
  upload: "업로드",
  download: "다운로드",
  saveAll: "저장",
  pasteGuide:
    "엑셀 복사 열 순서: 이름 | 부서코드(또는 부서명) | 직책 | 입사일(YYYY-MM-DD) | 재직상태(active/leave/resigned) | 이메일 | 활성(Y/N) | 비밀번호",
  colStatus: "상태",
  colDeleteMark: "삭제",
  colEmployeeNo: "사번",
  colLoginId: "로그인ID",
  colName: "이름",
  colDepartment: "부서",
  colPosition: "직책",
  colHireDate: "입사일",
  colEmploymentStatus: "재직상태",
  colEmail: "이메일",
  colActive: "활성",
  colPassword: "비밀번호(신규/변경)",
  colError: "에러",
};

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지",
  more: "더보기",
  to: "~",
  of: "/",
  next: "다음",
  last: "마지막",
  first: "처음",
  previous: "이전",
  loadingOoo: "로딩 중...",
  noRowsToShow: "데이터가 없습니다.",
  searchOoo: "검색...",
  blanks: "(빈값)",
  filterOoo: "필터...",
  applyFilter: "적용",
  equals: "같음",
  notEqual: "같지 않음",
  lessThan: "보다 작음",
  greaterThan: "보다 큼",
  contains: "포함",
  notContains: "미포함",
  startsWith: "시작",
  endsWith: "끝",
  andCondition: "그리고",
  orCondition: "또는",
  clearFilter: "초기화",
  resetFilter: "리셋",
  cancelFilter: "취소",
  textFilter: "텍스트 필터",
  numberFilter: "숫자 필터",
  dateFilter: "날짜 필터",
  selectAll: "전체 선택",
  selectAllSearchResults: "검색 결과 전체 선택",
  addCurrentSelectionToFilter: "현재 선택 추가",
  noMatches: "일치 항목 없음",
};
const STATUS_LABELS: Record<RowStatus, string> = {
  clean: I18N.statusClean,
  added: I18N.statusAdded,
  updated: I18N.statusUpdated,
  deleted: I18N.statusDeleted,
};

const LOCK_MARK = "🔒";
const lockHeader = (label: string) => `${label} ${LOCK_MARK}`;

/* ------------------------------------------------------------------ */
/* 공통 보조 함수                                                       */
/* ------------------------------------------------------------------ */
/** 원복 시 정상 상태 판정에 사용하는 추적 필드 */
const TRACKED_FIELDS: (keyof EmployeeItem)[] = [
  "display_name",
  "department_id",
  "position_title",
  "hire_date",
  "employment_status",
  "email",
  "is_active",
];

function snapshotOriginal(row: EmployeeItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isRevertedToOriginal(row: EmployeeGridRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(employee: EmployeeItem): EmployeeGridRow {
  return {
    ...employee,
    password: "",
    _status: "clean",
    _original: snapshotOriginal(employee),
  };
}

function normalizeEmploymentStatus(value: string): EmployeeItem["employment_status"] {
  const v = value.trim().toLowerCase();
  if (v === "leave" || v === "휴직") return "leave";
  if (v === "resigned" || v === "퇴직") return "resigned";
  return "active";
}

function parseBoolean(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "y" || v === "yes" || v === "true" || v === "1";
}

function normalizeDateKey(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  return text.slice(0, 10);
}

function toDisplayEmploymentStatus(
  status: EmployeeItem["employment_status"],
  labelByCode: Map<string, string>,
): string {
  return labelByCode.get(status) ?? status;
}

async function fetchHolidayDateKeys(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    const json = (await response.json()) as TimHolidayListResponse;
    return (json.items ?? []).map((h) => h.holiday_date);
  } catch {
    return [];
  }
}

async function fetchDepartments(url: string): Promise<DepartmentItem[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(await parseErrorDetail(response, I18N.loadDepartmentError));
  const json = (await response.json()) as { departments: DepartmentItem[] };
  return json.departments ?? [];
}

async function fetchActiveCodeOptions(url: string): Promise<CommonCodeOption[]> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    const json = (await response.json()) as ActiveCodeListResponse;
    return json.options ?? [];
  } catch {
    return [];
  }
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as unknown;
  return stringifyErrorDetail(json) ?? fallback;
}

function stringifyErrorDetail(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => stringifyErrorDetail(item))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(" / ") : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.msg === "string") {
    const loc = Array.isArray(record.loc)
      ? record.loc.map((part) => String(part)).join(".")
      : "";
    return loc ? `${loc}: ${record.msg}` : record.msg;
  }

  return (
    stringifyErrorDetail(record.detail) ??
    stringifyErrorDetail(record.message) ??
    stringifyErrorDetail(record.error)
  );
}

function buildEmployeeQuery(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.employeeNo.trim()) params.set("employee_no", filters.employeeNo.trim());
  if (filters.name.trim()) params.set("name", filters.name.trim());
  if (filters.department.trim()) params.set("department", filters.department.trim());
  if (filters.employmentStatuses.length === 1) params.set("employment_status", filters.employmentStatuses[0]);
  if (filters.active === "Y") params.set("active", "true");
  if (filters.active === "N") params.set("active", "false");
  return params;
}

function cloneFilters(filters: SearchFilters): SearchFilters {
  return {
    ...filters,
    positions: [...filters.positions],
    employmentStatuses: [...filters.employmentStatuses],
  };
}

type HireDateEditorProps = ICellEditorParams<EmployeeGridRow, string> & { holidays?: string[] };

const HireDateCellEditor = forwardRef<
  { getValue: () => string; isPopup: () => boolean },
  HireDateEditorProps
>(function HireDateCellEditor(props, ref) {
  const [value, setValue] = useState(() => normalizeDateKey(props.value));

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => value,
      isPopup: () => true,
    }),
    [value],
  );

  const handleChange = useCallback(
    (nextValue: string) => {
      setValue(nextValue);
      props.stopEditing();
    },
    [props],
  );

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2 shadow-lg">
      <CustomDatePicker
        value={value}
        onChange={handleChange}
        holidays={props.holidays ?? []}
        inline
        closeOnSelect={false}
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* 컴포넌트                                                            */
/* ------------------------------------------------------------------ */
export function EmployeeMasterManager() {
  const restoredViewState = cachedEmployeeMasterViewState;
  const [rows, setRows] = useState<EmployeeGridRow[]>(() => restoredViewState?.rows ?? []);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() =>
    restoredViewState ? cloneFilters(restoredViewState.searchFilters) : EMPTY_SEARCH_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(() =>
    restoredViewState ? cloneFilters(restoredViewState.appliedFilters) : EMPTY_SEARCH_FILTERS,
  );
  const [page, setPage] = useState(() => restoredViewState?.page ?? 1);
  const [pageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(() => restoredViewState?.totalCount ?? 0);
  const [initialLoading, setInitialLoading] = useState(() => (restoredViewState?.rows.length ?? 0) === 0);
  const [saving, setSaving] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingReloadAction, setPendingReloadAction] = useState<PendingReloadAction | null>(null);
  const [syncedPageKey, setSyncedPageKey] = useState<string | null>(() => restoredViewState?.syncedPageKey ?? null);

  const gridApiRef = useRef<GridApi<EmployeeGridRow> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(restoredViewState?.tempId ?? -1);
  const rowsRef = useRef<EmployeeGridRow[]>(restoredViewState?.rows ?? []);
  const departmentErrorToastRef = useRef<string | null>(null);
  const pageQueryKey = useMemo(
    () => JSON.stringify({ filters: appliedFilters, page, pageSize }),
    [appliedFilters, page, pageSize],
  );

  const { data: departments = [], error: departmentLoadError } = useSWR<DepartmentItem[], Error>(
    "/api/employees/departments",
    fetchDepartments,
    {
      revalidateOnFocus: true,
      revalidateIfStale: true,
      dedupingInterval: 60_000,
      shouldRetryOnError: false,
    },
  );
  const { data: positionOptions = [] } = useSWR<CommonCodeOption[]>(
    "/api/codes/groups/by-code/POSITION/active",
    fetchActiveCodeOptions,
    {
      revalidateOnFocus: true,
      revalidateIfStale: true,
      dedupingInterval: 60_000,
    },
  );
  const { data: employmentCodeOptions = [] } = useSWR<CommonCodeOption[]>(
    "/api/codes/groups/by-code/EMPLOYMENT_STATUS/active",
    fetchActiveCodeOptions,
    {
      revalidateOnFocus: true,
      revalidateIfStale: true,
      dedupingInterval: 60_000,
    },
  );
  const { data: fetchedHolidayDateKeys = [] } = useSWR<string[]>(
    `/api/tim/holidays?year=${new Date().getFullYear()}`,
    fetchHolidayDateKeys,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );
  const holidayDateKeys = useMemo(
    () => (fetchedHolidayDateKeys.length > 0 ? fetchedHolidayDateKeys : HOLIDAY_DATE_KEYS),
    [fetchedHolidayDateKeys],
  );
  const employmentOptions = useMemo(() => {
    const normalized = employmentCodeOptions.filter(
      (option): option is CommonCodeOption & { code: EmployeeItem["employment_status"] } =>
        option.code === "active" || option.code === "leave" || option.code === "resigned",
    );

    if (normalized.length > 0) {
      return normalized;
    }

    return FALLBACK_EMPLOYMENT_OPTIONS.map((option) => ({
      code: option.code,
      name: option.name,
    }));
  }, [employmentCodeOptions]);

  /* -- 파생값 ---------------------------------------------------- */
  const departmentNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of departments) map.set(d.id, d.name);
    return map;
  }, [departments]);

  const departmentLookupList = useMemo(
    () =>
      departments.map((d) => ({
        ...d,
        codeLower: d.code.toLowerCase(),
        nameLower: d.name.toLowerCase(),
      })),
    [departments],
  );

  const changeSummary = useMemo(() => {
    return summarizeGridStatuses(rows, (row) => row._status);
  }, [rows]);
  const hasDirtyRows = useMemo(() => rows.some((row) => row._status !== "clean"), [rows]);

  const runReloadAction = useCallback((action: PendingReloadAction, discardDirtyRows: boolean) => {
    gridApiRef.current?.stopEditing();
    gridApiRef.current?.deselectAll();

    if (discardDirtyRows) {
      rowsRef.current = [];
      setRows([]);
      setSyncedPageKey(null);
    }

    if (action.type === "page") {
      setPage(action.page);
      return;
    }

    setAppliedFilters(action.filters);
    setPage(1);
    tempIdRef.current = -1;
  }, []);

  const requestReloadAction = useCallback(
    (action: PendingReloadAction) => {
      if (action.type === "page" && action.page === page) return;
      if (hasDirtyRows) {
        setPendingReloadAction(action);
        setDiscardDialogOpen(true);
        return;
      }
      runReloadAction(action, false);
    },
    [hasDirtyRows, page, runReloadAction],
  );

  const {
    totalPages,
    pageInput,
    setPageInput,
    goPrev,
    goNext,
    goToPage,
  } = useGridPagination({
    page,
    totalCount,
    pageSize,
    onPageChange: (nextPage) => requestReloadAction({ type: "page", page: nextPage }),
  });

  const positionNames = useMemo(() => positionOptions.map((option) => option.name), [positionOptions]);
  const employmentStatusValues = useMemo(
    () =>
      employmentOptions
        .map((option) => option.code)
        .filter((code): code is EmployeeItem["employment_status"] => code === "active" || code === "leave" || code === "resigned"),
    [employmentOptions],
  );
  const employmentLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of employmentOptions) map.set(option.code, option.name);
    return map;
  }, [employmentOptions]);

  /* -- 임시 식별자 발급 ------------------------------------------------ */
  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const createEmptyRow = useCallback((): EmployeeGridRow => {
    const departmentId = departments[0]?.id ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: issueTempId(),
      employee_no: "",
      login_id: "",
      display_name: "",
      email: "",
      department_id: departmentId,
      department_name: departmentNameById.get(departmentId) ?? "",
      position_title: positionNames[0] ?? "사원",
      hire_date: today,
      employment_status: "active",
      is_active: true,
      password: "admin",
      _status: "added",
    };
  }, [departmentNameById, departments, issueTempId, positionNames]);

  useEffect(() => {
    if (!departmentLoadError) {
      departmentErrorToastRef.current = null;
      return;
    }

    const message = departmentLoadError.message || I18N.loadDepartmentError;
    if (departmentErrorToastRef.current === message) return;
    departmentErrorToastRef.current = message;
    toast.error(message);
  }, [departmentLoadError]);

  const getRowKey = useCallback((row: EmployeeGridRow) => String(row.id), []);

  const applyGridTransaction = useCallback(
    (prevRows: EmployeeGridRow[], nextRows: EmployeeGridRow[]) => {
      const api = gridApiRef.current;
      if (!api) return;

      const prevMap = new Map(prevRows.map((row) => [getRowKey(row), row]));
      const nextMap = new Map(nextRows.map((row) => [getRowKey(row), row]));
      const add: EmployeeGridRow[] = [];
      const update: EmployeeGridRow[] = [];
      const remove: EmployeeGridRow[] = [];

      for (const row of nextRows) {
        const previous = prevMap.get(getRowKey(row));
        if (!previous) {
          add.push(row);
          continue;
        }
        if (previous !== row) update.push(row);
      }

      for (const row of prevRows) {
        if (!nextMap.has(getRowKey(row))) remove.push(row);
      }

      if (add.length === 0 && update.length === 0 && remove.length === 0) return;

      api.applyTransaction({
        add: add.length > 0 ? add : undefined,
        update: update.length > 0 ? update : undefined,
        remove: remove.length > 0 ? remove : undefined,
        addIndex: add.length > 0 ? 0 : undefined,
      });
    },
    [getRowKey],
  );

  const commitRows = useCallback(
    (updater: (prevRows: EmployeeGridRow[]) => EmployeeGridRow[]) => {
      const prevRows = rowsRef.current;
      const nextRows = updater(prevRows);
      rowsRef.current = nextRows;
      setRows(nextRows);
      applyGridTransaction(prevRows, nextRows);
    },
    [applyGridTransaction],
  );

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      commitRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isRevertedToOriginal(candidate) && !candidate.password,
        }),
      );
    },
    [commitRows],
  );

  /* -- 초기 로딩 ------------------------------------------------------- */
  const fetchEmployeePage = useCallback(async (filters: SearchFilters, pageNo: number) => {
    const query = buildEmployeeQuery(filters);
    query.set("page", String(pageNo));
    query.set("limit", String(pageSize));

    const response = await fetch("/api/employees?" + query.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(await parseErrorDetail(response, I18N.loadEmployeeError));
    return response.json() as Promise<EmployeePageResponse>;
  }, [pageSize]);

  const {
    data: employeePageData,
    error: employeePageError,
    isLoading: employeePageLoading,
    isValidating: employeePageValidating,
    mutate: mutateEmployeePage,
  } = useSWR<EmployeePageResponse, Error>(
    ["employee-master-page", appliedFilters, page],
    ([, filters, pageNo]) => fetchEmployeePage(filters as SearchFilters, pageNo as number),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 15_000,
    },
  );
  const loading = employeePageLoading || employeePageValidating;

  useEffect(() => {
    if (!employeePageData) return;
    setInitialLoading(false);
    setTotalCount(employeePageData.total_count ?? employeePageData.employees.length);
    if (hasDirtyRows && syncedPageKey === pageQueryKey) {
      return;
    }
    const nextRows = employeePageData.employees.map((employee) => toGridRow(employee));
    rowsRef.current = nextRows;
    setRows(nextRows);
    setSyncedPageKey(pageQueryKey);
  }, [employeePageData, hasDirtyRows, pageQueryKey, syncedPageKey]);

  useEffect(() => {
    if (!employeePageError) return;
    setInitialLoading(false);
    toast.error(employeePageError.message || I18N.initError);
  }, [employeePageError]);

  useEffect(() => {
    cachedEmployeeMasterViewState = {
      rows,
      searchFilters: cloneFilters(searchFilters),
      appliedFilters: cloneFilters(appliedFilters),
      page,
      totalCount,
      tempId: tempIdRef.current,
      syncedPageKey,
    };
  }, [appliedFilters, page, rows, searchFilters, syncedPageKey, totalCount]);

  /* -- 컬럼 정의 ------------------------------------------------ */
  const columnDefs = useMemo<ColDef<EmployeeGridRow>[]>(() => {
    return [
      {
        headerName: lockHeader(I18N.colDeleteMark),
        headerTooltip: "직접 입력 수정 불가(삭제 체크로만 변경)",
        width: 56,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
        resizable: false,
        editable: false,
        cellRenderer: (params: ICellRendererParams<EmployeeGridRow>) => {
          const row = params.data;
          if (!row) return null;
          const checked = row._status === "deleted";
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={checked}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)]"
                onChange={(event) => toggleDeleteById(row.id, event.target.checked)}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          );
        },
      },
      {
        headerName: lockHeader(I18N.colStatus),
        headerTooltip: "시스템 상태 컬럼(자동 계산)",
        field: "_status",
        width: 80,
        editable: false,
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
      },
      {
        headerName: lockHeader(I18N.colEmployeeNo),
        headerTooltip: "신규 행에서만 수정 가능",
        field: "employee_no",
        width: 120,
        editable: (params) => params.data?._status === "added",
      },
      {
        headerName: lockHeader(I18N.colLoginId),
        headerTooltip: "신규 행에서만 수정 가능",
        field: "login_id",
        width: 130,
        editable: (params) => params.data?._status === "added",
      },
      {
        headerName: I18N.colName,
        field: "display_name",
        width: 120,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colDepartment,
        field: "department_id",
        width: 140,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: departments.map((d) => d.id) },
        valueFormatter: (params) => departmentNameById.get(Number(params.value)) ?? "",
        valueParser: (params) => Number(params.newValue),
      },
      {
        headerName: I18N.colPosition,
        field: "position_title",
        width: 120,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: positionNames.length > 0 ? positionNames : ["사원"] },
      },
      {
        headerName: I18N.colHireDate,
        field: "hire_date",
        width: 120,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: HireDateCellEditor,
        cellEditorParams: { holidays: holidayDateKeys },
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
      },
      {
        headerName: I18N.colEmploymentStatus,
        field: "employment_status",
        width: 110,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: employmentStatusValues },
        valueFormatter: (params) =>
          toDisplayEmploymentStatus(
            (params.value as EmployeeItem["employment_status"]) ?? "active",
            employmentLabelByCode,
          ),
      },
      {
        headerName: I18N.colEmail,
        field: "email",
        width: 180,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colActive,
        field: "is_active",
        width: 80,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (params) => (params.value ? "Y" : "N"),
        valueParser: (params) => params.newValue === "Y",
      },
      {
        headerName: I18N.colPassword,
        field: "password",
        width: 160,
        editable: (params) => params.data?._status !== "deleted",
      },
    ];
  }, [departmentNameById, departments, employmentLabelByCode, employmentStatusValues, holidayDateKeys, positionNames, toggleDeleteById]);

  const defaultColDef = useMemo<ColDef<EmployeeGridRow>>(
    () => ({ sortable: true, filter: true, resizable: true, editable: false }),
    [],
  );

  /* -- 클래스 기반 행 스타일 ---------------------------------- */
  const rowClassRules = useMemo(() => buildGridRowClassRules<EmployeeGridRow>(), []);
  const getRowClass = useCallback((params: RowClassParams<EmployeeGridRow>) => getGridRowClass(params.data?._status), []);

  /* -- 그리드 이벤트 ------------------------------------------------ */
  const onGridReady = useCallback((event: GridReadyEvent<EmployeeGridRow>) => {
    gridApiRef.current = event.api;
  }, []);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<EmployeeGridRow>) => {
      if (event.newValue === event.oldValue) return;

      const rowId = event.data?.id;
      const field = event.colDef.field as keyof EmployeeGridRow | undefined;
      if (rowId == null || !field) return;

      commitRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;

          const next: EmployeeGridRow = { ...row };

          if (field === "department_id") {
            const dId = Number(event.newValue);
            next.department_id = Number.isFinite(dId) ? dId : row.department_id;
            next.department_name = departmentNameById.get(next.department_id) ?? "";
          } else if (field === "employment_status") {
            next.employment_status = normalizeEmploymentStatus(String(event.newValue ?? "active"));
          } else if (field === "is_active") {
            next.is_active =
              typeof event.newValue === "boolean"
                ? event.newValue
                : parseBoolean(String(event.newValue ?? "N"));
          } else if (field === "hire_date") {
            next.hire_date = String(event.newValue ?? "").slice(0, 10);
          } else if (field === "password") {
            next.password = String(event.newValue ?? "");
          } else if (field === "login_id") {
            next.login_id = String(event.newValue ?? "").trim();
          } else if (field === "display_name") {
            next.display_name = String(event.newValue ?? "");
          } else if (field === "email") {
            next.email = String(event.newValue ?? "");
          } else if (field === "position_title") {
            next.position_title = String(event.newValue ?? "");
          } else if (field === "employee_no") {
            next.employee_no = String(event.newValue ?? "").trim();
          }

          return reconcileUpdatedStatus(next, {
            shouldBeClean: (candidate) => isRevertedToOriginal(candidate) && !candidate.password,
          });
        }),
      );
    },
    [commitRows, departmentNameById],
  );

  /* -- 액션 ---------------------------------------------------- */
  function addRows(count: number) {
    const added = Array.from({ length: count }, () => createEmptyRow());
    commitRows((prev) => [...added, ...prev]);
  }

  const parseDepartmentId = useCallback(
    (input: string): number => {
      const v = input.trim().toLowerCase();
      if (!v) return departments[0]?.id ?? 0;
      const matched = departmentLookupList.find((d) => d.codeLower === v || d.nameLower === v);
      return matched?.id ?? departments[0]?.id ?? 0;
    },
    [departmentLookupList, departments],
  );

  const handlePasteCapture = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      const text = event.clipboardData.getData("text/plain");
      if (!text || !text.includes("\t")) return;

      event.preventDefault();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length === 0) return;

      const parsed: EmployeeGridRow[] = lines.map((line) => {
        const c = line.split("\t").map((s) => s.trim());
        const deptId = parseDepartmentId(c[1] ?? "");
        return {
          id: issueTempId(),
          employee_no: "",
          login_id: "",
          display_name: c[0] ?? "",
          department_id: deptId,
          department_name: departmentNameById.get(deptId) ?? "",
          position_title: c[2] || "사원",
          hire_date: (c[3] || new Date().toISOString().slice(0, 10)).slice(0, 10),
          employment_status: normalizeEmploymentStatus(c[4] || "active"),
          email: c[5] || "",
          is_active: parseBoolean(c[6] || "Y"),
          password: c[7] || "admin",
          _status: "added" as const,
        };
      });

      commitRows((prev) => [...parsed, ...prev]);
    },
    [commitRows, departmentNameById, issueTempId, parseDepartmentId],
  );

  function copySelectedRows() {
    if (!gridApiRef.current) return;
    const selected = gridApiRef.current.getSelectedRows().filter((r) => r._status !== "deleted");
    if (selected.length === 0) return;

    const selectedIdSet = new Set(selected.map((r) => r.id));
    const clonesById = new Map<number, EmployeeGridRow>(
      selected.map((r) => [
        r.id,
        {
          ...r,
          id: issueTempId(),
          employee_no: "",
          login_id: "",
          _status: "added" as const,
          _original: undefined,
          _prevStatus: undefined,
        },
      ]),
    );

    commitRows((prev) => {
      const next: EmployeeGridRow[] = [];
      for (const row of prev) {
        next.push(row);
        if (selectedIdSet.has(row.id)) {
          const clone = clonesById.get(row.id);
          if (clone) next.push(clone);
        }
      }
      return next;
    });
  }

  async function downloadTemplateExcel() {
    try {
      const headers = [
        "사번",
        "이름",
        "부서코드(또는 부서명)",
        "직책",
        "입사일",
        "재직상태",
        "이메일",
        "활성(Y/N)",
        "비밀번호",
      ];
      const sample = ["", "홍길동", "HQ-HR", "사원", "2026-01-01", "active", "hong@vibe-hr.local", "Y", "admin"];

      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "업로드양식");
      writeFileXLSX(book, "employee-upload-template.xlsx");
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }

  async function downloadCurrentSheetExcel() {
    try {
      const headers = ["사번", "로그인ID", "이름", "부서", "직책", "입사일", "재직상태", "이메일", "활성"];
      const query = buildEmployeeQuery(appliedFilters);
      query.set("all", "true");
      const response = await fetch("/api/employees?" + query.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error("다운로드 조회 실패");
      const json = (await response.json()) as { employees: EmployeeItem[] };
      const data = (json.employees ?? []).map((r) => [
        r.employee_no,
        r.login_id,
        r.display_name,
        r.department_name || "",
        r.position_title,
        r.hire_date,
        toDisplayEmploymentStatus(r.employment_status, employmentLabelByCode),
        r.email,
        r.is_active ? "Y" : "N",
      ]);

      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...data]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "사원관리");
      writeFileXLSX(book, `employee-sheet-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }

  async function handleUploadFile(file: File) {
    try {
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(firstSheet, {
        header: 1,
        raw: false,
      });

      if (!rowsAoa || rowsAoa.length <= 1) return;

      // 양식 순서: 사번(0) | 이름(1) | 부서(2) | 직책(3) | 입사일(4) | 재직상태(5) | 이메일(6) | 활성(7) | 비밀번호(8)
      const parsed: EmployeeGridRow[] = [];
      for (const cells of rowsAoa.slice(1)) {
        const c = cells.map((v) => String(v ?? "").trim());
        if (!c.some((v) => v.length > 0)) continue;
        const deptId = parseDepartmentId(c[2] ?? "");
        parsed.push({
          id: issueTempId(),
          employee_no: c[0] ?? "",
          login_id: "",
          display_name: c[1] ?? "",
          department_id: deptId,
          department_name: departmentNameById.get(deptId) ?? "",
          position_title: c[3] || positionNames[0] || "사원",
          hire_date: (c[4] || new Date().toISOString().slice(0, 10)).slice(0, 10),
          employment_status: normalizeEmploymentStatus(c[5] || "active"),
          email: c[6] || "",
          is_active: parseBoolean(c[7] || "Y"),
          password: c[8] || "admin",
          _status: "added",
        });
      }

      commitRows((prev) => [...parsed, ...prev]);
    } catch {
      toast.error("엑셀 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요.");
    }
  }

  /* -- 조회: 전체 화면 로딩 없이 데이터만 재조회 ------- */
  function handleQuery() {
    const nextFilters: SearchFilters = {
      ...searchFilters,
      positions: [...searchFilters.positions],
      employmentStatuses: [...searchFilters.employmentStatuses],
    };
    requestReloadAction({ type: "query", filters: nextFilters });
  }

  /* -- 검증 및 저장 ------------------------------------------ */
  function validateRow(row: EmployeeGridRow): string | null {
    if (!row.display_name.trim() || row.display_name.trim().length < 2) return I18N.requiredName;
    if (!row.department_id || !departmentNameById.has(row.department_id)) return I18N.requiredDepartment;
    if (!row.position_title.trim()) return I18N.requiredPosition;
    return null;
  }

  async function saveAllChanges() {
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated");
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);

    if (toInsert.length + toUpdate.length + toDelete.length === 0) {
      return;
    }

    const validationErrors = new Map<number, string>();
    for (const r of [...toInsert, ...toUpdate]) {
      const msg = validateRow(r);
      if (msg) validationErrors.set(r.id, msg);
    }
    if (validationErrors.size > 0) {
      const details = Array.from(validationErrors.entries())
        .slice(0, 5)
        .map(([id, message]) => `ID ${id}: ${message}`)
        .join(" / ");
      toast.error(`${I18N.validationError} ${details}`);
      return;
    }

    setSaving(true);
    try {
      const payload = buildEmployeeBatchPayload(rows);
      const res = await fetch("/api/employees/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await parseErrorDetail(res, I18N.saveFailed);
        toast.error(detail);
        return;
      }

      const json = (await res.json()) as EmployeeBatchResponse;
      commitRows((prev) =>
        clearSavedStatuses(prev, {
          removeDeleted: true,
          buildOriginal: (row) => snapshotOriginal(row),
        }),
      );
      gridApiRef.current?.deselectAll();
      gridApiRef.current?.stopEditing();

      toast.success(
        `${I18N.saveDone} (입력 ${json.inserted_count}건 / 수정 ${json.updated_count}건 / 삭제 ${json.deleted_count}건)`,
      );

      try {
        setSyncedPageKey(null);
        await mutateEmployeePage();
      } catch {
        toast.warning("저장은 완료되었지만 목록 재조회에 실패했습니다.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = rows;


  const statusOptions = employmentOptions
    .map((option) => ({
      value: option.code,
      label: option.name,
    }))
    .filter(
      (option): option is { value: EmployeeItem["employment_status"]; label: string } =>
        option.value === "active" || option.value === "leave" || option.value === "resigned",
    );
  const handleEmploymentStatusChange = useCallback((values: EmployeeItem["employment_status"][]) => {
    setSearchFilters((prev) => ({ ...prev, employmentStatuses: values }));
  }, []);
  const positionFilterOptions = useMemo(
    () => positionNames.map((name) => ({ value: name, label: name })),
    [positionNames],
  );
  const handlePositionChange = useCallback((values: string[]) => {
    setSearchFilters((prev) => ({ ...prev, positions: values }));
  }, []);

  const departmentsReady = departments.length > 0;

  const toolbarActions = [
    {
      key: "add",
      label: I18N.addRow,
      icon: Plus,
      onClick: () => addRows(1),
      disabled: !departmentsReady,
    },
    {
      key: "copy",
      label: I18N.copy,
      icon: Copy,
      onClick: copySelectedRows,
    },
    {
      key: "template",
      label: I18N.templateDownload,
      icon: FileDown,
      onClick: () => void downloadTemplateExcel(),
    },
    {
      key: "upload",
      label: I18N.upload,
      icon: Upload,
      onClick: () => uploadInputRef.current?.click(),
    },
    {
      key: "download",
      label: I18N.download,
      icon: Download,
      onClick: () => void downloadCurrentSheetExcel(),
    },
  ];

  const toolbarSaveAction = {
    key: "save",
    label: saving ? `${I18N.saveAll}...` : I18N.saveAll,
    icon: Save,
    onClick: saveAllChanges,
    disabled: saving,
    variant: "save" as const,
  };

  function handleSearchFieldEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleQuery();
  }

  function handleDiscardDialogOpenChange(open: boolean) {
    setDiscardDialogOpen(open);
    if (!open) setPendingReloadAction(null);
  }

  function handleDiscardAndContinue() {
    if (!pendingReloadAction) {
      setDiscardDialogOpen(false);
      return;
    }
    runReloadAction(pendingReloadAction, true);
    setPendingReloadAction(null);
    setDiscardDialogOpen(false);
  }

  /* -- 렌더링 ----------------------------------------------------- */
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">{I18N.loading}</p>
      </div>
    );
  }

  return (
    <ManagerPageShell containerRef={containerRef} onPasteCapture={handlePasteCapture}>
      <ManagerSearchSection
        title={I18N.title}
        onQuery={() => {
          handleQuery();
        }}
        queryLabel={I18N.query}
      >
        <SearchFieldGrid className="xl:grid-cols-4 2xl:grid-cols-7">
          <div>
            <SearchTextField
              value={searchFilters.employeeNo}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, employeeNo: value }))}
              onKeyDown={handleSearchFieldEnter}
              placeholder={SEARCH_PLACEHOLDERS.employeeNo}
            />
          </div>
          <div>
            <SearchTextField
              value={searchFilters.name}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, name: value }))}
              onKeyDown={handleSearchFieldEnter}
              placeholder={SEARCH_PLACEHOLDERS.employeeName}
            />
          </div>
          <div>
            <SearchTextField
              value={searchFilters.department}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, department: value }))}
              onKeyDown={handleSearchFieldEnter}
              placeholder={SEARCH_PLACEHOLDERS.departmentName}
            />
          </div>
          <div>
            <MultiSelectFilter
              options={positionFilterOptions}
              values={searchFilters.positions}
              onChange={handlePositionChange}
              placeholder="전체"
              searchPlaceholder={`${SEARCH_PLACEHOLDERS.position} 검색`}
            />
          </div>
          <div>
            <CustomDatePicker
              value={searchFilters.hireDateTo}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, hireDateTo: value }))}
              holidays={holidayDateKeys}
              placeholder={SEARCH_PLACEHOLDERS.hireDateTo}
              className="w-full"
            />
          </div>
          <div>
            <select
              value={searchFilters.active}
              onChange={(e) =>
                setSearchFilters((prev) => ({
                  ...prev,
                  active: e.target.value as ActiveFilter,
                }))
              }
              onKeyDown={handleSearchFieldEnter}
              aria-label={SEARCH_PLACEHOLDERS.active}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">전체</option>
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
          </div>
          <div>
            <MultiSelectFilter
              options={statusOptions}
              values={searchFilters.employmentStatuses}
              onChange={handleEmploymentStatusChange}
              placeholder="전체"
              searchPlaceholder={`${SEARCH_PLACEHOLDERS.employmentStatus} 검색`}
            />
          </div>
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={(
          <>
            <GridPaginationControls
              page={page}
              totalPages={totalPages}
              pageInput={pageInput}
              setPageInput={setPageInput}
              goPrev={goPrev}
              goNext={goNext}
              goToPage={goToPage}
              disabled={loading || saving}
              className="mt-0 justify-start"
            />
            <span className="text-xs text-slate-500">총 {totalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} />
          </>
        )}
        headerRight={(
          <>
            <GridToolbarActions actions={toolbarActions} saveAction={toolbarSaveAction} />
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadFile(file);
                e.currentTarget.value = "";
              }}
            />
          </>
        )}
        contentClassName="flex min-h-0 flex-1 flex-col"
      >

      <div className="min-h-0 flex flex-1 flex-col px-6 pb-4">
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<EmployeeGridRow>
            theme="legacy"
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressRowClickSelection={false}
            singleClickEdit={true}
            animateRows={false}
            rowClassRules={rowClassRules}
            getRowClass={getRowClass}
            getRowId={(params) => String(params.data.id)}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            loading={loading}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate={`<span class="text-sm text-slate-400">${I18N.noRows}</span>`}
            headerHeight={36}
            rowHeight={34}
          />
        </div>
      </div>
      </ManagerGridSection>
      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={handleDiscardDialogOpenChange}
        title="저장되지 않은 변경 사항이 있습니다."
        description="현재 변경 내용을 저장하지 않고 이동하면 수정 내용이 사라집니다. 계속 진행하시겠습니까?"
        confirmLabel="무시하고 이동"
        cancelLabel="취소"
        confirmVariant="destructive"
        onConfirm={handleDiscardAndContinue}
      />
    </ManagerPageShell>
  );
}




