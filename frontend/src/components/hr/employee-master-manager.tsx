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

import {
  type CellValueChangedEvent,
  type ICellRendererParams,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellEditorParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { buildEmployeeBatchPayload } from "@/lib/hr/employee-batch";
import {
  hasRowPatchChanges,
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { SEARCH_PLACEHOLDERS } from "@/lib/grid/search-presets";
import { getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useMediaQuery } from "@/lib/use-media-query";
import type { ActiveCodeListResponse } from "@/types/common-code";
import type {
  EmployeeBatchResponse,
  DepartmentItem,
  EmployeeItem,
} from "@/types/employee";

/* AG Grid modules are provided globally via <AgGridProvider>. */

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

type EmployeeGridRow = EmployeeItem & {
  password: string;
  _status: RowStatus;
  /** 원복 판정을 위한 원본 필드 스냅샷 */
  _original?: Record<string, unknown>;
  /** 삭제 처리 전 상태(삭제 해제 시 복구용) */
  _prevStatus?: RowStatus;
};

type CommonCodeOption = { code: string; name: string };
let cachedPositionOptions: CommonCodeOption[] | null = null;
let cachedEmploymentOptions: CommonCodeOption[] | null = null;
let cachedDepartments: DepartmentItem[] | null = null;

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

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
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

type HireDateEditorProps = ICellEditorParams<EmployeeGridRow, string>;

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
        holidays={HOLIDAY_DATE_KEYS}
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
  const [rows, setRows] = useState<EmployeeGridRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>(() => cachedDepartments ?? []);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [positionOptions, setPositionOptions] = useState<CommonCodeOption[]>([]);
  const [employmentOptions, setEmploymentOptions] = useState<CommonCodeOption[]>(
    FALLBACK_EMPLOYMENT_OPTIONS.map((option) => ({ code: option.code, name: option.name })),
  );
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const gridApiRef = useRef<GridApi<EmployeeGridRow> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);
  const isDesktop = useMediaQuery("(min-width: 768px)", true);

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
    onPageChange: setPage,
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
    if (cachedPositionOptions) {
      setPositionOptions(cachedPositionOptions);
    }
    if (cachedEmploymentOptions) {
      setEmploymentOptions(cachedEmploymentOptions);
    }
    if (cachedPositionOptions && cachedEmploymentOptions) {
      return;
    }

    async function loadActiveCodes(groupCode: string): Promise<CommonCodeOption[]> {
      const res = await fetch(`/api/codes/groups/by-code/${groupCode}/active`, { cache: "no-store" });
      if (!res.ok) return [];
      const data = (await res.json()) as ActiveCodeListResponse;
      return data.options;
    }

    void (async () => {
      const [positions, employment] = await Promise.all([
        loadActiveCodes("POSITION"),
        loadActiveCodes("EMPLOYMENT_STATUS"),
      ]);

      if (positions.length > 0) {
        cachedPositionOptions = positions;
        setPositionOptions(positions);
      }

      let nextEmploymentOptions = FALLBACK_EMPLOYMENT_OPTIONS.map((option) => ({
        code: option.code,
        name: option.name,
      }));
      if (employment.length > 0) {
        const normalized = employment.filter(
          (option): option is CommonCodeOption & { code: EmployeeItem["employment_status"] } =>
            option.code === "active" || option.code === "leave" || option.code === "resigned",
        );
        if (normalized.length > 0) {
          nextEmploymentOptions = normalized;
        }
      }

      cachedEmploymentOptions = nextEmploymentOptions;
      setEmploymentOptions(nextEmploymentOptions);
    })();
  }, []);

  /* -- 데이터 변경 후 그리드 행 스타일 갱신 ------------------ */
  const refreshGridRows = useCallback(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.redrawRows();
  }, []);

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      setRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isRevertedToOriginal(candidate) && !candidate.password,
        }),
      );

      setTimeout(refreshGridRows, 0);
    },
    [refreshGridRows],
  );

  /* -- 초기 로딩 ------------------------------------------------------- */
  const fetchEmployeePage = useCallback(async (filters: SearchFilters, pageNo: number, signal?: AbortSignal) => {
    const query = buildEmployeeQuery(filters);
    query.set("page", String(pageNo));
    query.set("limit", String(pageSize));

    const response = await fetch("/api/employees?" + query.toString(), { cache: "no-store", signal });
    if (!response.ok) throw new Error(await parseErrorDetail(response, I18N.loadEmployeeError));
    return response.json() as Promise<{ employees: EmployeeItem[]; total_count: number }>;
  }, [pageSize]);

  const loadDepartments = useCallback(async () => {
    const response = await fetch("/api/employees/departments", { cache: "no-store" });
    if (!response.ok) throw new Error(await parseErrorDetail(response, I18N.loadDepartmentError));
    const json = (await response.json()) as { departments: DepartmentItem[] };
    const list = json.departments ?? [];
    cachedDepartments = list;
    setDepartments(list);
  }, []);

  useEffect(() => {
    if (cachedDepartments && cachedDepartments.length > 0) return;

    void (async () => {
      try {
        await loadDepartments();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : I18N.loadDepartmentError);
      }
    })();
  }, [loadDepartments]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        const data = await fetchEmployeePage(appliedFilters, page, controller.signal);
        if (controller.signal.aborted) return;
        setRows(data.employees.map((employee) => toGridRow(employee)));
        setTotalCount(data.total_count ?? data.employees.length);
      } catch (error: unknown) {
        if ((error as { name?: string } | null)?.name === "AbortError") return;
        toast.error(error instanceof Error ? error.message : I18N.initError);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [appliedFilters, fetchEmployeePage, page]);

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
  }, [departmentNameById, departments, employmentLabelByCode, employmentStatusValues, positionNames, toggleDeleteById]);

  const defaultColDef = useMemo<ColDef<EmployeeGridRow>>(
    () => ({ sortable: true, filter: true, resizable: true, editable: false }),
    [],
  );

  /* -- 클래스 기반 행 스타일 ---------------------------------- */
  const getRowClass = useCallback((params: { data?: EmployeeGridRow }) => {
    return getGridRowClass(params.data?._status);
  }, []);

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

      setRows((prev) =>
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

      // 상태 변경 후 행 스타일 반영을 위해 다시 그리기
      setTimeout(refreshGridRows, 0);
    },
    [departmentNameById, refreshGridRows],
  );

  const patchRow = useCallback(
    (rowId: number, patch: Partial<EmployeeGridRow>) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          if (!hasRowPatchChanges(row, patch)) return row;

          const next: EmployeeGridRow = { ...row, ...patch };
          if ("_status" in patch) return next;

          return reconcileUpdatedStatus(next, {
            shouldBeClean: (candidate) => isRevertedToOriginal(candidate) && !candidate.password,
          });
        }),
      );
      setTimeout(refreshGridRows, 0);
    },
    [refreshGridRows],
  );

  /* -- 액션 ---------------------------------------------------- */
  function addRows(count: number) {
    const added = Array.from({ length: count }, () => createEmptyRow());
    setRows((prev) => [...added, ...prev]);
    setTimeout(refreshGridRows, 0);
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

      setRows((prev) => [...parsed, ...prev]);
      setTimeout(refreshGridRows, 0);
    },
    [departmentNameById, issueTempId, parseDepartmentId, refreshGridRows],
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

    setRows((prev) => {
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

    setTimeout(refreshGridRows, 0);
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

      setRows((prev) => [...parsed, ...prev]);
      setTimeout(refreshGridRows, 0);
    } catch {
      toast.error("엑셀 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요.");
    }
  }

  /* -- 조회: 전체 화면 로딩 없이 데이터만 재조회 ------- */
  async function handleQuery() {
    gridApiRef.current?.stopEditing();
    gridApiRef.current?.deselectAll();

    const nextFilters: SearchFilters = {
      ...searchFilters,
      positions: [...searchFilters.positions],
      employmentStatuses: [...searchFilters.employmentStatuses],
    };
    setAppliedFilters(nextFilters);
    setPage(1);
    tempIdRef.current = -1;
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
      const pageData = await fetchEmployeePage(appliedFilters, page);
      setRows(pageData.employees.map((employee) => toGridRow(employee)));
      setTotalCount(pageData.total_count ?? pageData.employees.length);
      gridApiRef.current?.deselectAll();
      gridApiRef.current?.stopEditing();

      toast.success(
        `${I18N.saveDone} (입력 ${json.inserted_count}건 / 수정 ${json.updated_count}건 / 삭제 ${json.deleted_count}건)`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = rows;


  const mobileRows = filteredRows;
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
    void handleQuery();
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
          void handleQuery();
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
              holidays={HOLIDAY_DATE_KEYS}
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
            <span className="text-xs text-slate-400">
              총 {totalCount.toLocaleString()}건 · {page} / {Math.max(1, Math.ceil(totalCount / pageSize))}페이지
            </span>
            <GridChangeSummaryBadges summary={changeSummary} className="ml-2" />
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

      {isDesktop ? (
        <div className="min-h-0 flex flex-1 flex-col px-3 pb-4 pt-2 md:px-6 md:pt-0">
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
          <GridPaginationControls
            page={page}
            totalPages={totalPages}
            pageInput={pageInput}
            setPageInput={setPageInput}
            goPrev={goPrev}
            goNext={goNext}
            goToPage={goToPage}
            disabled={loading || saving}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-3 pb-4 pt-2">
          <div className="space-y-2">
            {mobileRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                {I18N.noRows}
              </div>
            ) : (
              mobileRows.map((row) => {
                const deptName = row.department_name || departmentNameById.get(row.department_id) || "";
                const isDeleted = row._status === "deleted";
                return (
                  <div key={row.id} className={`rounded-lg border bg-white p-3 ${isDeleted ? "border-red-300 bg-red-50/40" : "border-slate-200"}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        {row.employee_no || "신규"} · {deptName || "부서 미지정"}
                      </div>
                      <label className="flex items-center gap-1 text-xs text-red-600">
                        <input
                          type="checkbox"
                          checked={isDeleted}
                          onChange={(e) => toggleDeleteById(row.id, e.target.checked)}
                        />
                        삭제
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={row.display_name}
                        disabled={isDeleted}
                        onChange={(e) => patchRow(row.id, { display_name: e.target.value })}
                        placeholder="이름"
                        className="h-9"
                      />
                      <select
                        value={String(row.department_id)}
                        disabled={isDeleted}
                        onChange={(e) => {
                          const dId = Number(e.target.value);
                          patchRow(row.id, {
                            department_id: dId,
                            department_name: departmentNameById.get(dId) ?? "",
                          });
                        }}
                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.position_title}
                        disabled={isDeleted}
                        onChange={(e) => patchRow(row.id, { position_title: e.target.value })}
                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      >
                        {(positionNames.length > 0 ? positionNames : [row.position_title || "사원"]).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <div className={`col-span-2 ${isDeleted ? "pointer-events-none opacity-60" : ""}`}>
                        <CustomDatePicker
                          className="w-full"
                          value={row.hire_date}
                          onChange={(value) => patchRow(row.id, { hire_date: value })}
                          holidays={HOLIDAY_DATE_KEYS}
                        />
                      </div>
                      <Input
                        value={row.email}
                        disabled={isDeleted}
                        onChange={(e) => patchRow(row.id, { email: e.target.value })}
                        placeholder="이메일"
                        className="col-span-2 h-9"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      </ManagerGridSection>
    </ManagerPageShell>
  );
}



