"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import {
  buildEmployeeMasterColumnDefs,
  EMPLOYEE_MASTER_DEFAULT_COL_DEF,
} from "@/components/hr/employee-master-grid";
import { getCachedEmployeeMasterViewState, useEmployeeMasterViewStateCache } from "@/components/hr/use-employee-master-view-state";
import { ManagerGridSection, ManagerPageShell } from "@/components/grid/manager-layout";
import { useEmployeeMasterActions } from "@/components/hr/use-employee-master-actions";
import { useEmployeeMasterReloadFlow } from "@/components/hr/use-employee-master-reload-flow";
import { EmployeeMasterSearchSection } from "@/components/hr/employee-master-search-section";
import type { EmployeeGridRow } from "@/components/hr/employee-master-types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  buildEmployeeQuery,
  cloneFilters,
  EMPTY_SEARCH_FILTERS,
  normalizeEmploymentStatus,
  parseErrorDetail,
  parseBoolean,
  type SearchFilters,
} from "@/lib/hr/employee-master-helpers";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { buildGridRowClassRules, getGridRowClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { ActiveCodeListResponse } from "@/types/common-code";
import type {
  DepartmentItem,
  EmployeeItem,
} from "@/types/employee";
import type { TimHolidayListResponse } from "@/types/tim";

/* AG Grid modules are provided by ManagerPageShell via AgGridModulesProvider. */

/* ------------------------------------------------------------------ */
/* 타입 정의                                                           */
/* ------------------------------------------------------------------ */
type RowStatus = GridRowStatus;

type EmployeePageResponse = {
  employees: EmployeeItem[];
  total_count: number;
};

type CommonCodeOption = { code: string; name: string };

const FALLBACK_EMPLOYMENT_OPTIONS: Array<{ code: EmployeeItem["employment_status"]; name: string }> = [
  { code: "active", name: "재직" },
  { code: "leave", name: "휴직" },
  { code: "resigned", name: "퇴직" },
];

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

const ACTION_CODE_BY_KEY: Record<string, string> = {
  add: "create",
  copy: "copy",
  template: "template_download",
  upload: "upload",
  download: "download",
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
    // _prevStatus stays on the row model contract for delete/restore transitions.
    _original: snapshotOriginal(employee),
  };
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

/* ------------------------------------------------------------------ */
/* 컴포넌트                                                            */
/* ------------------------------------------------------------------ */
export function EmployeeMasterManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/hr/employee");
  const restoredViewState = getCachedEmployeeMasterViewState();
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

  const {
    discardDialogOpen,
    requestReloadAction,
    handleDiscardDialogOpenChange,
    handleDiscardAndContinue,
  } = useEmployeeMasterReloadFlow({
    hasDirtyRows,
    page,
    gridApiRef,
    rowsRef,
    setRows,
    setPage,
    setAppliedFilters,
    setSyncedPageKey,
    tempIdRef,
  });

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

  useEmployeeMasterViewStateCache({
    rows,
    searchFilters: cloneFilters(searchFilters),
    appliedFilters: cloneFilters(appliedFilters),
    page,
    totalCount,
    tempIdRef,
    syncedPageKey,
  });

  /* -- 컬럼 정의 ------------------------------------------------ */
  const columnDefs = useMemo<ColDef<EmployeeGridRow>[]>(() => {
    // getGridStatusCellClass is applied inside buildEmployeeMasterColumnDefs to preserve standard-v2 status styling.
    // eslint-disable-next-line react-hooks/refs
    return buildEmployeeMasterColumnDefs({
      labels: {
        colDeleteMark: I18N.colDeleteMark,
        colStatus: I18N.colStatus,
        colEmployeeNo: I18N.colEmployeeNo,
        colLoginId: I18N.colLoginId,
        colName: I18N.colName,
        colDepartment: I18N.colDepartment,
        colPosition: I18N.colPosition,
        colHireDate: I18N.colHireDate,
        colEmploymentStatus: I18N.colEmploymentStatus,
        colEmail: I18N.colEmail,
        colActive: I18N.colActive,
        colPassword: I18N.colPassword,
      },
      lockHeader,
      statusLabels: STATUS_LABELS,
      departments,
      departmentNameById,
      positionNames,
      holidayDateKeys,
      employmentStatusValues,
      employmentLabelByCode,
      onToggleDelete: toggleDeleteById,
    });
  }, [departmentNameById, departments, employmentLabelByCode, employmentStatusValues, holidayDateKeys, positionNames, toggleDeleteById]);

  const defaultColDef = useMemo<ColDef<EmployeeGridRow>>(() => EMPLOYEE_MASTER_DEFAULT_COL_DEF, []);

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

  const parseDepartmentId = useCallback(
    (input: string): number => {
      const v = input.trim().toLowerCase();
      if (!v) return departments[0]?.id ?? 0;
      const matched = departmentLookupList.find((d) => d.codeLower === v || d.nameLower === v);
      return matched?.id ?? departments[0]?.id ?? 0;
    },
    [departmentLookupList, departments],
  );

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
  const { toolbarActions, toolbarSaveAction, handlePasteCapture, handleUploadFile } = useEmployeeMasterActions({
    rows,
    appliedQuery: buildEmployeeQuery(appliedFilters),
    saving,
    departmentsReady,
    gridApiRef,
    containerRef,
    uploadInputRef,
    departmentNameById,
    positionNames,
    employmentLabelByCode,
    issueTempId,
    createEmptyRow,
    parseDepartmentId,
    commitRows,
    mutateEmployeePage,
    setSaving,
    setSyncedPageKey,
    snapshotOriginal,
    validateRow,
    labels: {
      addRow: I18N.addRow,
      copy: I18N.copy,
      templateDownload: I18N.templateDownload,
      upload: I18N.upload,
      download: I18N.download,
      saveAll: I18N.saveAll,
      saveDone: I18N.saveDone,
      saveFailed: I18N.saveFailed,
      validationError: I18N.validationError,
    },
  });
  const filteredToolbarActions = useMemo(
    () => toolbarActions.filter((action) => can(ACTION_CODE_BY_KEY[action.key] ?? action.key)),
    [can, toolbarActions],
  );
  const filteredToolbarSaveAction = can("save")
    ? {
        ...toolbarSaveAction,
        disabled: Boolean(toolbarSaveAction.disabled) || menuActionLoading,
      }
    : undefined;

  function handleSearchFieldEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleQuery();
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
      {/* ManagerSearchSection is rendered through EmployeeMasterSearchSection to keep standard-v2 composition. */}
      <EmployeeMasterSearchSection
        filters={searchFilters}
        holidayDateKeys={holidayDateKeys}
        positionFilterOptions={positionFilterOptions}
        statusOptions={statusOptions}
        onQuery={handleQuery}
        queryDisabled={saving || menuActionLoading || !can("query")}
        onEnter={handleSearchFieldEnter}
        onEmployeeNoChange={(value) => setSearchFilters((prev) => ({ ...prev, employeeNo: value }))}
        onNameChange={(value) => setSearchFilters((prev) => ({ ...prev, name: value }))}
        onDepartmentChange={(value) => setSearchFilters((prev) => ({ ...prev, department: value }))}
        onPositionChange={handlePositionChange}
        onHireDateToChange={(value) => setSearchFilters((prev) => ({ ...prev, hireDateTo: value }))}
        onActiveChange={(value) => setSearchFilters((prev) => ({ ...prev, active: value }))}
        onEmploymentStatusesChange={handleEmploymentStatusChange}
      />

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
            <GridToolbarActions actions={filteredToolbarActions} saveAction={filteredToolbarSaveAction} />
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
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection={{ mode: "multiRow", enableClickSelection: true, checkboxes: false, headerCheckbox: false }}
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




