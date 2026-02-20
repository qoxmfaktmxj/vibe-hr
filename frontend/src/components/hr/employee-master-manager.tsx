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
  Search,
  Plus,
  Copy,
  FileDown,
  Upload,
  Download,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellEditorParams,
  type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import type {
  DepartmentItem,
  DepartmentListResponse,
  EmployeeDetailResponse,
  EmployeeItem,
  EmployeeListResponse,
} from "@/types/employee";

/* ------------------------------------------------------------------ */
/* AG Grid module registration (once)                                  */
/* ------------------------------------------------------------------ */
let modulesRegistered = false;
if (!modulesRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  modulesRegistered = true;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type RowStatus = "clean" | "added" | "updated" | "deleted";
type ActiveFilter = "" | "Y" | "N";
type SearchFilters = {
  employeeNo: string;
  name: string;
  department: string;
  position: string;
  hireDateTo: string;
  employmentStatuses: EmployeeItem["employment_status"][];
  active: ActiveFilter;
};

type EmployeeGridRow = EmployeeItem & {
  password: string;
  _status: RowStatus;
  _error?: string;
  /** Snapshot of original field values so we can detect "reverted edits" */
  _original?: Record<string, unknown>;
  /** Status before being marked deleted ??so we can restore */
  _prevStatus?: RowStatus;
};

const EMPTY_SEARCH_FILTERS: SearchFilters = {
  employeeNo: "",
  name: "",
  department: "",
  position: "",
  hireDateTo: "",
  employmentStatuses: [],
  active: "",
};

/* ------------------------------------------------------------------ */
/* i18n                                                                */
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
  title: "사원 마스터",
  searchPlaceholder: "사번 / 이름 / 부서 검색",
  query: "조회",
  addRow: "입력",
  copy: "복사",
  deleteRow: "삭제",
  templateDownload: "양식 다운로드",
  upload: "업로드",
  download: "다운로드",
  saveAll: "저장",
  pasteGuide:
    "엑셀 복사 열 순서: 이름 | 부서코드(또는 부서명) | 직책 | 입사일(YYYY-MM-DD) | 재직상태(active/leave/resigned) | 이메일 | 활성(Y/N) | 비밀번호",
  colStatus: "상태",
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

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
/** Fields that we track for "revert to original = back to clean" */
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
  const snap: Record<string, unknown> = {};
  for (const f of TRACKED_FIELDS) snap[f] = row[f];
  return snap;
}

function isRevertedToOriginal(row: EmployeeGridRow): boolean {
  if (!row._original) return false;
  for (const f of TRACKED_FIELDS) {
    if (row[f] !== row._original[f]) return false;
  }
  return true;
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
  if (v === "leave" || v === "?댁쭅") return "leave";
  if (v === "resigned" || v === "?댁궗") return "resigned";
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

function hasRowPatchChanges(row: EmployeeGridRow, patch: Partial<EmployeeGridRow>): boolean {
  for (const [key, value] of Object.entries(patch)) {
    const rowKey = key as keyof EmployeeGridRow;
    if (row[rowKey] !== value) return true;
  }
  return false;
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
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
/* Component                                                           */
/* ------------------------------------------------------------------ */
export function EmployeeMasterManager() {
  const [rows, setRows] = useState<EmployeeGridRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [gridMountKey, setGridMountKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const gridApiRef = useRef<GridApi<EmployeeGridRow> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);
  /** Guard to suppress re-entrant selectionChanged during programmatic updates */
  const suppressSelectionRef = useRef(false);

  /* -- derived ---------------------------------------------------- */
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
    const s = { added: 0, updated: 0, deleted: 0 };
    for (const r of rows) {
      if (r._status === "added") s.added += 1;
      else if (r._status === "updated") s.updated += 1;
      else if (r._status === "deleted") s.deleted += 1;
    }
    return s;
  }, [rows]);

  /* -- id helper -------------------------------------------------- */
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
      position_title: "사원",
      hire_date: today,
      employment_status: "active",
      is_active: true,
      password: "admin",
      _status: "added",
    };
  }, [departmentNameById, departments, issueTempId]);

  /* -- Refresh grid row styles after data change ------------------ */
  const refreshGridRows = useCallback(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.redrawRows();
  }, []);

  /* -- load ------------------------------------------------------- */
  const loadBase = useCallback(async () => {
    setLoading(true);
    const [empRes, deptRes] = await Promise.all([
      fetch("/api/employees", { cache: "no-store" }),
      fetch("/api/employees/departments", { cache: "no-store" }),
    ]);
    if (!empRes.ok) throw new Error(await parseErrorDetail(empRes, I18N.loadEmployeeError));
    if (!deptRes.ok) throw new Error(await parseErrorDetail(deptRes, I18N.loadDepartmentError));

    const empJson = (await empRes.json()) as EmployeeListResponse;
    const deptJson = (await deptRes.json()) as DepartmentListResponse;

    setDepartments(deptJson.departments);
    setRows(empJson.employees.map((e) => toGridRow(e)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadBase();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : I18N.initError);
        setLoading(false);
      }
    })();
  }, [loadBase]);

  /* -- column defs ------------------------------------------------ */
  const columnDefs = useMemo<ColDef<EmployeeGridRow>[]>(() => {
    const statusOptions: EmployeeItem["employment_status"][] = ["active", "leave", "resigned"];
    return [
      {
        headerName: "",
        checkboxSelection: true,
        headerCheckboxSelection: true,
        width: 48,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
      },
      {
        headerName: I18N.colStatus,
        field: "_status",
        width: 80,
        editable: false,
        cellClass: (params) => {
          const s = params.value as RowStatus;
          if (s === "added") return "vibe-status-added";
          if (s === "updated") return "vibe-status-updated";
          if (s === "deleted") return "vibe-status-deleted";
          return "";
        },
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
      },
      {
        headerName: I18N.colEmployeeNo,
        field: "employee_no",
        width: 120,
        editable: (params) => params.data?._status === "added",
      },
      {
        headerName: I18N.colLoginId,
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
        cellEditorParams: { values: statusOptions },
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
      { headerName: I18N.colError, field: "_error", width: 220, editable: false },
    ];
  }, [departmentNameById, departments]);

  const defaultColDef = useMemo<ColDef<EmployeeGridRow>>(
    () => ({ sortable: true, filter: true, resizable: true, editable: false }),
    [],
  );

  /* -- row styling via CSS class ---------------------------------- */
  const getRowClass = useCallback((params: RowClassParams<EmployeeGridRow>) => {
    if (!params.data) return "";
    if (params.data._status === "added") return "vibe-row-added";
    if (params.data._status === "updated") return "vibe-row-updated";
    if (params.data._status === "deleted") return "vibe-row-deleted";
    return "";
  }, []);

  /* -- grid events ------------------------------------------------ */
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

          const next: EmployeeGridRow = { ...row, _error: undefined };

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

          /* --- revert detection ---- */
          if (next._status === "clean") {
            next._status = "updated";
          } else if (next._status === "updated" && isRevertedToOriginal(next) && !next.password) {
            // All tracked fields match original & no password change => back to clean
            next._status = "clean";
          }

          return next;
        }),
      );

      // Redraw after state update so row class refreshes
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

          const next: EmployeeGridRow = { ...row, ...patch, _error: undefined };
          if ("_status" in patch) return next;

          if (next._status === "clean") {
            next._status = "updated";
          } else if (next._status === "updated" && isRevertedToOriginal(next) && !next.password) {
            next._status = "clean";
          }
          return next;
        }),
      );
      setTimeout(refreshGridRows, 0);
    },
    [refreshGridRows],
  );

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      setRows((prev) => {
        const next: EmployeeGridRow[] = [];
        for (const row of prev) {
          if (row.id !== rowId) {
            next.push(row);
            continue;
          }

          if (!checked) {
            if (row._status === "deleted") {
              next.push({
                ...row,
                _status: row._prevStatus ?? "clean",
                _prevStatus: undefined,
                _error: undefined,
              });
            } else {
              next.push(row);
            }
            continue;
          }

          if (row._status === "added") {
            continue;
          }

          if (row._status !== "deleted") {
            next.push({ ...row, _status: "deleted", _prevStatus: row._status, _error: undefined });
          } else {
            next.push(row);
          }
        }
        return next;
      });

      setTimeout(refreshGridRows, 0);
    },
    [refreshGridRows],
  );

  /**
   * Delete selected rows (via the "??젣" button):
   * - added => remove row entirely
   * - clean / updated => mark as deleted (remember previous status)
   * - deleted => restore to previous status (toggle)
   */
  const handleSelectionChanged = useCallback(() => {
    if (suppressSelectionRef.current || !gridApiRef.current) return;

    const selected = gridApiRef.current.getSelectedRows();
    if (selected.length === 0) return;

    const selectedIds = new Set(selected.map((row) => row.id));
    setRows((prev) => {
      const next: EmployeeGridRow[] = [];
      for (const row of prev) {
        if (!selectedIds.has(row.id)) {
          next.push(row);
          continue;
        }

        if (row._status === "added") {
          continue;
        }

        if (row._status === "deleted") {
          next.push({
            ...row,
            _status: row._prevStatus ?? "clean",
            _prevStatus: undefined,
            _error: undefined,
          });
        } else {
          next.push({
            ...row,
            _status: "deleted",
            _prevStatus: row._status,
            _error: undefined,
          });
        }
      }
      return next;
    });

    suppressSelectionRef.current = true;
    setTimeout(() => {
      refreshGridRows();
      if (gridApiRef.current) {
        gridApiRef.current.deselectAll();
      }
      suppressSelectionRef.current = false;
    }, 0);
  }, [refreshGridRows]);

  const handleDeleteSelected = useCallback(() => {
    if (!gridApiRef.current) return;
    const selected = gridApiRef.current.getSelectedRows();
    if (selected.length === 0) return;

    const selectedIds = new Set(selected.map((r) => r.id));

    setRows((prev) => {
      const next: EmployeeGridRow[] = [];
      for (const row of prev) {
        if (!selectedIds.has(row.id)) {
          next.push(row);
          continue;
        }

        if (row._status === "added") {
          // new row: just remove from list
          continue;
        }

        if (row._status === "deleted") {
          // restore to previous status
          const restored: EmployeeGridRow = {
            ...row,
            _status: row._prevStatus ?? "clean",
            _prevStatus: undefined,
            _error: undefined,
          };
          // If restored and values match original, ensure clean
          if (restored._status === "updated" && isRevertedToOriginal(restored) && !restored.password) {
            restored._status = "clean";
          }
          next.push(restored);
        } else {
          // clean or updated => mark as deleted
          next.push({
            ...row,
            _status: "deleted",
            _prevStatus: row._status,
            _error: undefined,
          });
        }
      }
      return next;
    });

    // Keep checkboxes selected on deleted rows, deselect on restored/removed rows
    // Redraw to refresh row styling
    suppressSelectionRef.current = true;
    setTimeout(() => {
      refreshGridRows();
      // Deselect all after processing
      if (gridApiRef.current) {
        gridApiRef.current.deselectAll();
      }
      suppressSelectionRef.current = false;
    }, 0);
  }, [refreshGridRows]);

  /* -- actions ---------------------------------------------------- */
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
          _error: undefined,
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
  }

  async function downloadCurrentSheetExcel() {
    const headers = ["사번", "로그인ID", "이름", "부서", "직책", "입사일", "재직상태", "이메일", "활성"];
    const data = rows
      .filter((r) => r._status !== "deleted")
      .map((r) => [
        r.employee_no,
        r.login_id,
        r.display_name,
        r.department_name || departmentNameById.get(r.department_id) || "",
        r.position_title,
        r.hire_date,
        r.employment_status,
        r.email,
        r.is_active ? "Y" : "N",
      ]);

    const { utils, writeFileXLSX } = await import("xlsx");
    const sheet = utils.aoa_to_sheet([headers, ...data]);
    const book = utils.book_new();
    utils.book_append_sheet(book, sheet, "사원관리");
    writeFileXLSX(book, `employee-sheet-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleUploadFile(file: File) {
    const { read, utils } = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(firstSheet, {
      header: 1,
      raw: false,
    });

    if (!rowsAoa || rowsAoa.length <= 1) return;

    const parsed: EmployeeGridRow[] = [];
    for (const cells of rowsAoa.slice(1)) {
      const c = cells.map((v) => String(v ?? "").trim());
      if (!c.some((v) => v.length > 0)) continue;
      const deptId = parseDepartmentId(c[1] ?? "");
      parsed.push({
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
        _status: "added",
      });
    }

    setRows((prev) => [...parsed, ...prev]);
    setTimeout(refreshGridRows, 0);
  }

  /* -- query: reload grid data only (no full-screen loading) ------- */
  async function handleQuery() {
    const nextFilters: SearchFilters = {
      ...searchFilters,
      employmentStatuses: [...searchFilters.employmentStatuses],
    };
    setAppliedFilters(nextFilters);

    try {
      const [empRes, deptRes] = await Promise.all([
        fetch("/api/employees", { cache: "no-store" }),
        fetch("/api/employees/departments", { cache: "no-store" }),
      ]);
      if (!empRes.ok) throw new Error(await parseErrorDetail(empRes, I18N.loadEmployeeError));
      if (!deptRes.ok) throw new Error(await parseErrorDetail(deptRes, I18N.loadDepartmentError));

      const empJson = (await empRes.json()) as EmployeeListResponse;
      const deptJson = (await deptRes.json()) as DepartmentListResponse;

      setDepartments(deptJson.departments);
      setRows(empJson.employees.map((e) => toGridRow(e)));
      tempIdRef.current = -1;
      gridApiRef.current = null;
      suppressSelectionRef.current = false;
      setGridMountKey((prev) => prev + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.initError);
    }
  }

  /* -- validation & save ------------------------------------------ */
  function validateRow(row: EmployeeGridRow): string | null {
    if (!row.display_name.trim() || row.display_name.trim().length < 2) return I18N.requiredName;
    if (!row.department_id || !departmentNameById.has(row.department_id)) return I18N.requiredDepartment;
    if (!row.position_title.trim()) return I18N.requiredPosition;
    return null;
  }

  async function saveAllChanges() {
    const toInsert = rows.filter((r) => r._status === "added");
    const toUpdate = rows.filter((r) => r._status === "updated");
    const toDelete = rows.filter((r) => r._status === "deleted" && r.id > 0);

    if (toInsert.length + toUpdate.length + toDelete.length === 0) {
      return;
    }

    const validationErrors = new Map<number, string>();
    for (const r of [...toInsert, ...toUpdate]) {
      const msg = validateRow(r);
      if (msg) validationErrors.set(r.id, msg);
    }
    if (validationErrors.size > 0) {
      setRows((prev) => prev.map((r) => ({ ...r, _error: validationErrors.get(r.id) })));
      toast.error(I18N.validationError);
      return;
    }

    setSaving(true);

    const nextRows = [...rows];
    const failedMessages: string[] = [];

    const deleteResults = await Promise.all(
      toDelete.map(async (row) => {
        const res = await fetch(`/api/employees/${row.id}`, { method: "DELETE" });
        if (!res.ok) {
          return { id: row.id, ok: false as const, message: await parseErrorDetail(res, I18N.deleteFailed) };
        }
        return { id: row.id, ok: true as const };
      }),
    );

    const insertResults = await Promise.all(
      toInsert.map(async (row) => {
        const payload = {
          employee_no: row.employee_no.trim() || undefined,
          display_name: row.display_name.trim(),
          department_id: row.department_id,
          position_title: row.position_title.trim() || "사원",
          hire_date: row.hire_date || null,
          employment_status: row.employment_status,
          email: row.email.trim() || null,
          login_id: row.login_id.trim() || null,
          password: row.password.trim() || "admin",
        };
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json().catch(() => null)) as EmployeeDetailResponse | { detail?: string } | null;
        if (!res.ok) {
          return {
            id: row.id,
            ok: false as const,
            message: (json as { detail?: string } | null)?.detail ?? I18N.saveFailed,
          };
        }
        return { id: row.id, ok: true as const, employee: (json as EmployeeDetailResponse).employee };
      }),
    );

    const updateResults = await Promise.all(
      toUpdate.map(async (row) => {
        const payload = {
          display_name: row.display_name.trim(),
          department_id: row.department_id,
          position_title: row.position_title.trim() || "사원",
          hire_date: row.hire_date || null,
          employment_status: row.employment_status,
          email: row.email.trim(),
          is_active: row.is_active,
          password: row.password.trim() ? row.password.trim() : undefined,
        };
        const res = await fetch(`/api/employees/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json().catch(() => null)) as EmployeeDetailResponse | { detail?: string } | null;
        if (!res.ok) {
          return {
            id: row.id,
            ok: false as const,
            message: (json as { detail?: string } | null)?.detail ?? I18N.saveFailed,
          };
        }
        return { id: row.id, ok: true as const, employee: (json as EmployeeDetailResponse).employee };
      }),
    );

    const deleteSuccess = new Set(deleteResults.filter((r) => r.ok).map((r) => r.id));
    const insertSuccess = new Map(
      insertResults
        .filter((r): r is { id: number; ok: true; employee: EmployeeItem } => r.ok)
        .map((r) => [r.id, r.employee]),
    );
    const updateSuccess = new Map(
      updateResults
        .filter((r): r is { id: number; ok: true; employee: EmployeeItem } => r.ok)
        .map((r) => [r.id, r.employee]),
    );

    const errorById = new Map<number, string>();
    for (const r of [...deleteResults, ...insertResults, ...updateResults]) {
      if (!r.ok) {
        errorById.set(r.id, r.message);
        failedMessages.push(`ID ${r.id}: ${r.message}`);
      }
    }

    const mergedRows = nextRows
      .filter((r) => !deleteSuccess.has(r.id))
      .map((r) => {
        const created = insertSuccess.get(r.id);
        if (created) return { ...toGridRow(created), _error: undefined };

        const updated = updateSuccess.get(r.id);
        if (updated) return { ...toGridRow(updated), _error: undefined };

        if (errorById.has(r.id)) return { ...r, _error: errorById.get(r.id) };

        if (r._status === "deleted" && r.id < 0) return null;
        return r;
      });

    setRows(mergedRows.filter((r): r is EmployeeGridRow => r !== null));
    setSaving(false);

    setTimeout(refreshGridRows, 0);

    if (failedMessages.length > 0) {
      toast.error(`${I18N.savePartial} (${failedMessages.length}嫄?`);
      return;
    }

    toast.success(I18N.saveDone);
  }

  const filteredRows = useMemo(() => {
    const employeeNo = appliedFilters.employeeNo.trim().toLowerCase();
    const name = appliedFilters.name.trim().toLowerCase();
    const department = appliedFilters.department.trim().toLowerCase();
    const position = appliedFilters.position.trim().toLowerCase();
    const hireDateTo = appliedFilters.hireDateTo.trim();
    const active = appliedFilters.active;
    const statusFilter = new Set(appliedFilters.employmentStatuses);

    return rows.filter((row) => {
      const departmentName = (row.department_name || departmentNameById.get(row.department_id) || "").toLowerCase();
      const positionTitle = row.position_title.toLowerCase();
      const hireDate = normalizeDateKey(row.hire_date);

      if (employeeNo && !row.employee_no.toLowerCase().includes(employeeNo)) return false;
      if (name && !row.display_name.toLowerCase().includes(name)) return false;
      if (department && !departmentName.includes(department)) return false;
      if (position && !positionTitle.includes(position)) return false;
      if (hireDateTo && (!hireDate || hireDate > hireDateTo)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(row.employment_status)) return false;
      if (active === "Y" && !row.is_active) return false;
      if (active === "N" && row.is_active) return false;

      return true;
    });
  }, [appliedFilters, departmentNameById, rows]);

  const mobileRows = filteredRows;
  const statusOptions: Array<{ value: EmployeeItem["employment_status"]; label: string }> = [
    { value: "active", label: "재직" },
    { value: "leave", label: "휴직" },
    { value: "resigned", label: "퇴직" },
  ];

  function toggleEmploymentStatus(value: EmployeeItem["employment_status"], checked: boolean) {
    setSearchFilters((prev) => {
      const next = new Set(prev.employmentStatuses);
      if (checked) next.add(value);
      else next.delete(value);
      return { ...prev, employmentStatuses: Array.from(next) };
    });
  }

  function handleSearchFieldEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void handleQuery();
  }

  /* -- render ----------------------------------------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">{I18N.loading}</p>
      </div>
    );
  }

  const hasChanges = changeSummary.added + changeSummary.updated + changeSummary.deleted > 0;

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col" ref={containerRef} onPasteCapture={handlePasteCapture}>
      {/* ?? Search bar area ??????????????????????????????????? */}
      <div className="border-b border-gray-200 bg-white px-3 py-3 md:px-6">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <Input
            value={searchFilters.employeeNo}
            onChange={(e) => setSearchFilters((prev) => ({ ...prev, employeeNo: e.target.value }))}
            onKeyDown={handleSearchFieldEnter}
            placeholder="사번 검색"
            className="h-9 text-sm"
          />
          <Input
            value={searchFilters.name}
            onChange={(e) => setSearchFilters((prev) => ({ ...prev, name: e.target.value }))}
            onKeyDown={handleSearchFieldEnter}
            placeholder="이름 검색"
            className="h-9 text-sm"
          />
          <Input
            value={searchFilters.department}
            onChange={(e) => setSearchFilters((prev) => ({ ...prev, department: e.target.value }))}
            onKeyDown={handleSearchFieldEnter}
            placeholder="부서 검색"
            className="h-9 text-sm"
          />
          <Input
            value={searchFilters.position}
            onChange={(e) => setSearchFilters((prev) => ({ ...prev, position: e.target.value }))}
            onKeyDown={handleSearchFieldEnter}
            placeholder="직책 검색"
            className="h-9 text-sm"
          />
          <CustomDatePicker
            value={searchFilters.hireDateTo}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, hireDateTo: value }))}
            holidays={HOLIDAY_DATE_KEYS}
            placeholder="입사일 이전 검색"
            className="w-full"
          />
          <select
            value={searchFilters.active}
            onChange={(e) =>
              setSearchFilters((prev) => ({
                ...prev,
                active: e.target.value as ActiveFilter,
              }))
            }
            onKeyDown={handleSearchFieldEnter}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="">활성 전체</option>
            <option value="Y">활성(Y)</option>
            <option value="N">비활성(N)</option>
          </select>
          <div className="rounded-md border border-gray-200 px-2 py-1.5">
            <div className="mb-1 text-xs text-slate-500">재직상태</div>
            <div className="flex items-center gap-3">
              {statusOptions.map((option) => (
                <label key={option.value} className="inline-flex items-center gap-1 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={searchFilters.employmentStatuses.includes(option.value)}
                    onChange={(e) => toggleEmploymentStatus(option.value, e.target.checked)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <Button size="sm" variant="query" onClick={() => void handleQuery()} className="h-9">
            <Search className="h-3.5 w-3.5" />
            조회
          </Button>
        </div>
      </div>

      {/* ?? Sheet header: title + buttons ???????????????????? */}
      <div className="flex flex-col gap-2 border-b border-gray-100 bg-white px-3 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-800">
            {I18N.title}
          </h2>
          <span className="text-xs text-slate-400">
            {filteredRows.length.toLocaleString()} / {rows.length.toLocaleString()}건
          </span>
          {hasChanges && (
            <div className="flex items-center gap-2 ml-2">
              {changeSummary.added > 0 && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  +{changeSummary.added}
                </span>
              )}
              {changeSummary.updated > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  ~{changeSummary.updated}
                </span>
              )}
              {changeSummary.deleted > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  -{changeSummary.deleted}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => addRows(1)}>
            <Plus className="h-3.5 w-3.5" />
            {I18N.addRow}
          </Button>
          <Button size="sm" variant="outline" onClick={copySelectedRows}>
            <Copy className="h-3.5 w-3.5" />
            {I18N.copy}
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDeleteSelected}>
            <Trash2 className="h-3.5 w-3.5" />
            {I18N.deleteRow}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void downloadTemplateExcel()}>
            <FileDown className="h-3.5 w-3.5" />
            {I18N.templateDownload}
          </Button>
          <Button size="sm" variant="outline" onClick={() => uploadInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            {I18N.upload}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void downloadCurrentSheetExcel()}>
            <Download className="h-3.5 w-3.5" />
            {I18N.download}
          </Button>

          {/* Separator */}
          <div className="mx-1 h-6 w-px bg-gray-200" />

          <Button size="sm" variant="save" onClick={saveAllChanges} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? `${I18N.saveAll}...` : I18N.saveAll}
          </Button>
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
        </div>
      </div>

      {/* ?? Mobile cards ????????????????????????????????????? */}
      <div className="flex-1 overflow-auto px-3 pb-4 pt-2 md:hidden">
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
                    <Input
                      value={row.position_title}
                      disabled={isDeleted}
                      onChange={(e) => patchRow(row.id, { position_title: e.target.value })}
                      placeholder="직책"
                      className="h-9"
                    />
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

      {/* ?? AG Grid (Desktop) ??????????????????????????????? */}
      <div className="hidden flex-1 px-6 pb-4 pt-2 md:block">
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<EmployeeGridRow>
            key={gridMountKey}
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            animateRows={false}
            getRowClass={getRowClass}
            getRowId={(params) => String(params.data.id)}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            onSelectionChanged={handleSelectionChanged}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate={`<span class="text-sm text-slate-400">${I18N.noRows}</span>`}
            headerHeight={36}
            rowHeight={34}
          />
        </div>
      </div>
    </div>
  );
}



