"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Copy, Download, Plus, Save } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import {
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellEditorParams,
  type ICellRendererParams,
  type RowClassParams,
} from "ag-grid-community";
import { toast } from "sonner";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import {
  buildGridRowClassRules,
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import { isRowRevertedToOriginal, snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import {
  buildLookupEditorOptions,
  createSavePayload,
  loadDepartmentLookupOptions,
  loadMappingItemLookupOptions,
  type LookupEditorOption,
} from "@/components/org/org-mapping-assignment-manager.helpers";
import type {
  OrgMappingAssignmentItem,
  OrgMappingAssignmentListResponse,
  OrganizationLookupItem,
} from "@/types/organization";

type RowStatus = GridRowStatus;

type RowData = OrgMappingAssignmentItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

type SearchFilters = {
  departmentId: string;
  typeCode: string;
  referenceDate: string;
};

type PendingReloadAction =
  | { type: "page"; page: number }
  | { type: "query"; filters: SearchFilters };

type AssignmentSaveOutcome =
  | { type: "delete"; rowId: number }
  | { type: "upsert"; previousId: number; row: OrgMappingAssignmentItem };

type SelectEditorParams = ICellEditorParams<RowData, string | number> & {
  options: LookupEditorOption[];
};

type DateEditorParams = ICellEditorParams<RowData, string | null>;

const TRACKED_FIELDS: (keyof OrgMappingAssignmentItem)[] = [
  "department_id",
  "department_code",
  "department_name",
  "type_code",
  "item_id",
  "item_code",
  "item_name",
  "effective_from",
  "effective_to",
];

const I18N = {
  title: "조직구분",
  loading: "조직구분 데이터를 불러오는 중...",
  loadError: "조직구분 목록을 불러오지 못했습니다.",
  saveDone: "저장이 완료되었습니다.",
  saveFail: "저장에 실패했습니다.",
  noRows: "조직구분 데이터가 없습니다.",
  addRow: "입력",
  copy: "복사",
  download: "다운로드",
  save: "저장",
  query: "조회",
  colDelete: "삭제",
  colStatus: "상태",
  colDepartmentCode: "부서코드",
  colDepartmentName: "부서명",
  colTypeCode: "유형코드",
  colItemCode: "항목코드",
  colItemName: "항목명",
  colEffectiveFrom: "시작일",
  colEffectiveTo: "종료일",
};

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
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

function snapshotOriginal(row: OrgMappingAssignmentItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isReverted(row: RowData): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: OrgMappingAssignmentItem): RowData {
  return {
    ...item,
    _status: "clean",
    _original: snapshotOriginal(item),
  };
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
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.msg === "string") {
    const loc = Array.isArray(record.loc) ? record.loc.map((part) => String(part)).join(".") : "";
    return loc ? `${loc}: ${record.msg}` : record.msg;
  }
  return stringifyErrorDetail(record.detail) ?? stringifyErrorDetail(record.message) ?? stringifyErrorDetail(record.error);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCode(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function normalizeId(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRequiredDate(value: unknown): string {
  return normalizeText(value).slice(0, 10);
}

function normalizeOptionalDate(value: unknown): string | null {
  const text = normalizeText(value).slice(0, 10);
  return text.length > 0 ? text : null;
}

function buildTypeEditorOptions(types: OrganizationLookupItem[]): LookupEditorOption[] {
  return types.map((type) => ({
    value: type.code,
    label: `${type.code} / ${type.name}`,
  }));
}

function applySuccessfulAssignmentSave<T extends RowData>(
  rows: readonly T[],
  outcome: AssignmentSaveOutcome,
): T[] {
  if (outcome.type === "delete") {
    return rows.filter((row) => row.id !== outcome.rowId);
  }

  const cleanRow = {
    ...outcome.row,
    _status: "clean" as const,
    _original: snapshotOriginal(outcome.row),
    _prevStatus: undefined,
  } as T;

  const index = rows.findIndex((row) => row.id === outcome.previousId);
  if (index < 0) {
    return [...rows, cleanRow];
  }

  const next = rows.slice();
  next[index] = cleanRow;
  return next;
}

const LookupSelectEditor = forwardRef<{ getValue: () => string; isPopup: () => boolean }, SelectEditorParams>(
  function LookupSelectEditor(props, ref) {
    const [value, setValue] = useState<string>(String(props.value ?? ""));

    useImperativeHandle(
      ref,
      () => ({
        getValue: () => value,
        isPopup: () => true,
      }),
      [value],
    );

    return (
      <select
        autoFocus
        value={value}
        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground shadow-lg outline-none"
        onChange={(event) => {
          setValue(event.target.value);
          props.stopEditing();
        }}
      >
        <option value="">선택</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
);

const DateCellEditor = forwardRef<{ getValue: () => string; isPopup: () => boolean }, DateEditorParams>(
  function DateCellEditor(props, ref) {
    const [value, setValue] = useState<string>(typeof props.value === "string" ? props.value.slice(0, 10) : "");

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
      <div className="rounded-md border border-border bg-background p-2 shadow-lg">
        <CustomDatePicker value={value} onChange={handleChange} inline closeOnSelect={false} />
      </div>
    );
  },
);

export function OrgMappingAssignmentManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/org/types");
  const [rows, setRows] = useState<RowData[]>([]);
  const [typeOptions, setTypeOptions] = useState<OrganizationLookupItem[]>([]);
  const [departmentLookupOptions, setDepartmentLookupOptions] = useState<OrganizationLookupItem[]>([]);
  const [itemLookupOptionsByTypeCode, setItemLookupOptionsByTypeCode] = useState<Record<string, OrganizationLookupItem[]>>({});
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    departmentId: "",
    typeCode: "",
    referenceDate: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({
    departmentId: "",
    typeCode: "",
    referenceDate: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingReloadAction, setPendingReloadAction] = useState<PendingReloadAction | null>(null);

  const gridApiRef = useRef<GridApi<RowData> | null>(null);
  const rowsRef = useRef<RowData[]>([]);
  const tempIdRef = useRef(-1);
  const itemLookupOptionsLoadingRef = useRef(new Set<string>());
  const itemLookupOptionsByTypeCodeRef = useRef<Record<string, OrganizationLookupItem[]>>({});

  useEffect(() => {
    itemLookupOptionsByTypeCodeRef.current = itemLookupOptionsByTypeCode;
  }, [itemLookupOptionsByTypeCode]);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);
  const hasDirtyRows = useMemo(() => rows.some((row) => row._status !== "clean"), [rows]);
  const departmentSelectOptions = useMemo(() => buildLookupEditorOptions(departmentLookupOptions), [departmentLookupOptions]);
  const typeSelectOptions = useMemo(() => buildTypeEditorOptions(typeOptions), [typeOptions]);
  const canCreateAction = !menuActionLoading && can("create");
  const canCopyAction = !menuActionLoading && can("copy");
  const canSaveAction = !menuActionLoading && !loading && can("save");
  const departmentById = useMemo(() => {
    const entries: Array<[number, OrganizationLookupItem]> = [];
    for (const department of departmentLookupOptions) {
      if (department.id != null) entries.push([department.id, department]);
    }
    return new Map(entries);
  }, [departmentLookupOptions]);

  const getRowKey = useCallback((row: RowData) => String(row.id), []);

  const applyGridTransaction = useCallback(
    (prevRows: RowData[], nextRows: RowData[]) => {
      const api = gridApiRef.current;
      if (!api) return;

      const prevMap = new Map(prevRows.map((row) => [getRowKey(row), row]));
      const nextMap = new Map(nextRows.map((row) => [getRowKey(row), row]));
      const add: RowData[] = [];
      const update: RowData[] = [];
      const remove: RowData[] = [];

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
    (updater: (prevRows: RowData[]) => RowData[]) => {
      const prevRows = rowsRef.current;
      const nextRows = updater(prevRows);
      rowsRef.current = nextRows;
      setRows(nextRows);
      applyGridTransaction(prevRows, nextRows);
    },
    [applyGridTransaction],
  );

  const loadTypeOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/org/mapping-type-options", { cache: "no-store" });
      if (!response.ok) {
        setTypeOptions([]);
        return;
      }
      const data = (await response.json()) as { items?: OrganizationLookupItem[] };
      setTypeOptions(data.items ?? []);
    } catch {
      setTypeOptions([]);
    }
  }, []);

  const ensureItemLookupOptions = useCallback(async (typeCodeInput: string) => {
    const typeCode = normalizeCode(typeCodeInput);
    if (!typeCode) return;
    if (itemLookupOptionsByTypeCodeRef.current[typeCode] || itemLookupOptionsLoadingRef.current.has(typeCode)) return;

    itemLookupOptionsLoadingRef.current.add(typeCode);
    try {
      const nextItems = await loadMappingItemLookupOptions(typeCode);
      if (!nextItems) return;
      setItemLookupOptionsByTypeCode((prev) => {
        if (prev[typeCode]) return prev;
        const next = { ...prev, [typeCode]: nextItems };
        itemLookupOptionsByTypeCodeRef.current = next;
        return next;
      });
    } catch {
      return;
    } finally {
      itemLookupOptionsLoadingRef.current.delete(typeCode);
    }
  }, []);

  useEffect(() => {
    void loadTypeOptions();
    void loadDepartmentLookupOptions().then((items) => setDepartmentLookupOptions(items ?? []));
  }, [loadTypeOptions]);

  useEffect(() => {
    const typeCodes = new Set<string>();
    const filterTypeCode = normalizeCode(appliedFilters.typeCode);
    if (filterTypeCode) typeCodes.add(filterTypeCode);
    for (const row of rows) {
      const typeCode = normalizeCode(row.type_code);
      if (typeCode) typeCodes.add(typeCode);
    }
    for (const typeCode of typeCodes) {
      void ensureItemLookupOptions(typeCode);
    }
  }, [appliedFilters.typeCode, ensureItemLookupOptions, rows]);

  const runReloadAction = useCallback((action: PendingReloadAction, discardDirtyRows: boolean) => {
    gridApiRef.current?.stopEditing();
    gridApiRef.current?.deselectAll();

    if (discardDirtyRows) {
      rowsRef.current = [];
      setRows([]);
      setSelectedId(null);
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

  const fetchAssignments = useCallback(
    async (filters: SearchFilters, pageNo: number) => {
      const params = new URLSearchParams();
      params.set("page", String(pageNo));
      params.set("limit", String(pageSize));
      if (filters.departmentId.trim()) params.set("department_id", filters.departmentId.trim());
      if (filters.typeCode.trim()) params.set("type_code", filters.typeCode.trim());
      if (filters.referenceDate.trim()) params.set("reference_date", filters.referenceDate.trim());

      const response = await fetch(`/api/org/mapping-assignments?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as unknown;
        throw new Error(stringifyErrorDetail(json) ?? I18N.loadError);
      }
      return (await response.json()) as OrgMappingAssignmentListResponse;
    },
    [pageSize],
  );

  const runQuery = useCallback(
    async (filters: SearchFilters, pageNo: number) => {
      setLoading(true);
      try {
        const response = await fetchAssignments(filters, pageNo);
        const nextRows = response.items.map(toGridRow);
        rowsRef.current = nextRows;
        setRows(nextRows);
        setTotalCount(response.total_count ?? nextRows.length);
        setSelectedId(nextRows[0]?.id ?? null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : I18N.loadError);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [fetchAssignments],
  );

  useEffect(() => {
    void runQuery(appliedFilters, page);
  }, [appliedFilters, page, runQuery]);

  const defaultColDef = useMemo<ColDef<RowData>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
      suppressMovable: true,
      minWidth: 100,
    }),
    [],
  );

  const getItemEditorOptions = useCallback(
    (typeCodeInput: string) =>
      buildLookupEditorOptions(itemLookupOptionsByTypeCodeRef.current[normalizeCode(typeCodeInput)] ?? []),
    [],
  );

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      if (!canSaveAction) return;
      commitRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isReverted(candidate),
        }),
      );
    },
    [canSaveAction, commitRows],
  );

  const columnDefs = useMemo<ColDef<RowData>[]>(() => {
    return [
      {
        headerName: I18N.colDelete,
        field: "_status",
        width: 62,
        pinned: "left",
        sortable: false,
        filter: false,
        editable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: ICellRendererParams<RowData>) => {
          const row = params.data;
          if (!row) return null;
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={row._status === "deleted"}
                disabled={!canSaveAction}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)] disabled:cursor-not-allowed"
                onChange={(event) => {
                  if (!canSaveAction) return;
                  toggleDeleteById(row.id, event.target.checked);
                }}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          );
        },
      },
      {
        headerName: I18N.colStatus,
        field: "_status",
        width: 80,
        editable: false,
        sortable: false,
        filter: false,
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
      },
      {
        headerName: I18N.colDepartmentCode,
        field: "department_id",
        width: 150,
        editable: (params) => canSaveAction && params.data?._status !== "deleted",
        cellEditor: LookupSelectEditor,
        cellEditorParams: { options: departmentSelectOptions },
        valueParser: (params) => normalizeId(params.newValue),
        valueFormatter: (params) => params.data?.department_code ?? departmentById.get(Number(params.value))?.code ?? "",
      },
      {
        headerName: I18N.colDepartmentName,
        field: "department_name",
        flex: 1.1,
        minWidth: 180,
        editable: false,
      },
      {
        headerName: I18N.colTypeCode,
        field: "type_code",
        width: 130,
        editable: (params) => canSaveAction && params.data?._status !== "deleted",
        cellEditor: LookupSelectEditor,
        cellEditorParams: { options: typeSelectOptions },
        valueParser: (params) => normalizeCode(params.newValue),
      },
      {
        headerName: I18N.colItemCode,
        field: "item_id",
        width: 160,
        editable: (params) => canSaveAction && params.data?._status !== "deleted",
        cellEditor: LookupSelectEditor,
        cellEditorParams: (params: ICellEditorParams<RowData, number>) => ({
          options: getItemEditorOptions(params.data?.type_code ?? ""),
        }),
        valueParser: (params) => normalizeId(params.newValue),
        valueFormatter: (params) => params.data?.item_code ?? "",
      },
      {
        headerName: I18N.colItemName,
        field: "item_name",
        flex: 1.2,
        minWidth: 180,
        editable: false,
      },
      {
        headerName: I18N.colEffectiveFrom,
        field: "effective_from",
        width: 120,
        editable: (params) => canSaveAction && params.data?._status !== "deleted",
        cellEditor: DateCellEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
        valueParser: (params) => normalizeRequiredDate(params.newValue),
        valueFormatter: (params) => (typeof params.value === "string" ? params.value.slice(0, 10) : ""),
      },
      {
        headerName: I18N.colEffectiveTo,
        field: "effective_to",
        width: 120,
        editable: (params) => canSaveAction && params.data?._status !== "deleted",
        cellEditor: DateCellEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: "under",
        valueParser: (params) => normalizeOptionalDate(params.newValue),
        valueFormatter: (params) => (typeof params.value === "string" ? params.value.slice(0, 10) : ""),
      },
    ];
  }, [canSaveAction, departmentById, departmentSelectOptions, getItemEditorOptions, toggleDeleteById, typeSelectOptions]);

  const getRowClass = useCallback((params: RowClassParams<RowData>) => getGridRowClass(params.data?._status), []);
  const rowClassRules = useMemo(() => buildGridRowClassRules<RowData>(), []);

  const onGridReady = useCallback((event: GridReadyEvent<RowData>) => {
    gridApiRef.current = event.api;
  }, []);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<RowData>) => {
      if (!canSaveAction) return;
      if (event.newValue === event.oldValue) return;
      const rowId = event.data?.id;
      const field = event.colDef.field as keyof RowData | undefined;
      if (rowId == null || !field) return;

      commitRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const next = { ...row } as RowData;

          if (field === "department_id") {
            const nextDepartmentId = normalizeId(event.newValue);
            const department = departmentById.get(nextDepartmentId);
            next.department_id = nextDepartmentId;
            next.department_code = department?.code ?? "";
            next.department_name = department?.name ?? "";
          } else if (field === "type_code") {
            const nextTypeCode = normalizeCode(event.newValue);
            next.type_code = nextTypeCode;
            next.item_id = 0;
            next.item_code = "";
            next.item_name = "";
            void ensureItemLookupOptions(nextTypeCode);
          } else if (field === "item_id") {
            const nextItemId = normalizeId(event.newValue);
            const itemOptions = itemLookupOptionsByTypeCodeRef.current[normalizeCode(next.type_code)] ?? [];
            const item = itemOptions.find((candidate) => candidate.id === nextItemId);
            next.item_id = nextItemId;
            next.item_code = item?.code ?? "";
            next.item_name = item?.name ?? "";
          } else if (field === "effective_from") {
            next.effective_from = normalizeRequiredDate(event.newValue);
          } else if (field === "effective_to") {
            next.effective_to = normalizeOptionalDate(event.newValue);
          } else {
            next[field] = event.newValue as never;
          }

          return reconcileUpdatedStatus(next, {
            shouldBeClean: (candidate) => isReverted(candidate),
          });
        }),
      );
    },
    [canSaveAction, commitRows, departmentById, ensureItemLookupOptions],
  );

  function addRow() {
    if (!canCreateAction || !canSaveAction) return;
    const newId = tempIdRef.current;
    tempIdRef.current -= 1;
    const now = new Date().toISOString();
    const defaultDepartmentId = normalizeId(searchFilters.departmentId) || departmentLookupOptions[0]?.id || 0;
    const defaultTypeCode = normalizeCode(searchFilters.typeCode) || typeOptions[0]?.code || "";
    const defaultDepartment = departmentById.get(defaultDepartmentId);
    const defaultItem = (itemLookupOptionsByTypeCodeRef.current[defaultTypeCode] ?? []).find((item) => item.id != null);

    if (defaultTypeCode) {
      void ensureItemLookupOptions(defaultTypeCode);
    }

    const newRow: RowData = {
      id: newId,
      department_id: defaultDepartmentId,
      department_code: defaultDepartment?.code ?? "",
      department_name: defaultDepartment?.name ?? "",
      type_code: defaultTypeCode,
      item_id: defaultItem?.id ?? 0,
      item_code: defaultItem?.code ?? "",
      item_name: defaultItem?.name ?? "",
      effective_from: now.slice(0, 10),
      effective_to: null,
      created_at: now,
      updated_at: now,
      _status: "added",
    };

    commitRows((prev) => [newRow, ...prev]);
    setSelectedId(newId);
  }

  function copyRow() {
    if (!canCopyAction || !canSaveAction) return;
    if (!selectedRow || selectedRow._status === "deleted") return;
    const newId = tempIdRef.current;
    tempIdRef.current -= 1;
    const now = new Date().toISOString();

    const copied: RowData = {
      ...selectedRow,
      id: newId,
      created_at: now,
      updated_at: now,
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };

    commitRows((prev) => {
      const index = prev.findIndex((row) => row.id === selectedRow.id);
      if (index < 0) return [copied, ...prev];
      return [...prev.slice(0, index + 1), copied, ...prev.slice(index + 1)];
    });
    setSelectedId(newId);
  }

  async function downloadXlsx() {
    const exportRows = rows
      .filter((row) => row._status !== "deleted")
      .map((row, index) => ({
        No: index + 1,
        상태: STATUS_LABELS[row._status],
        부서코드: row.department_code,
        부서명: row.department_name,
        유형코드: row.type_code,
        항목코드: row.item_code,
        항목명: row.item_name,
        시작일: row.effective_from,
        종료일: row.effective_to ?? "",
      }));

    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "조직배정");
    XLSX.writeFile(workbook, "org-mapping-assignments.xlsx");
  }

  async function saveAll() {
    if (!canSaveAction) return;
    gridApiRef.current?.stopEditing();

    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated");

    if (toDelete.length + toInsert.length + toUpdate.length === 0) return;

    const invalid = [...toInsert, ...toUpdate].find((row) => {
      return (
        row.department_id <= 0 ||
        row.item_id <= 0 ||
        !normalizeCode(row.type_code) ||
        !normalizeText(row.item_code) ||
        !normalizeText(row.department_code) ||
        !normalizeRequiredDate(row.effective_from)
      );
    });
    if (invalid) {
      toast.error("부서 / 유형 / 항목 / 시작일은 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      for (const row of toDelete) {
        const response = await fetch(`/api/org/mapping-assignments/${row.id}`, { method: "DELETE" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as unknown;
          throw new Error(stringifyErrorDetail(payload) ?? `삭제 실패: ${row.department_code} / ${row.item_code}`);
        }
        commitRows((prev) => applySuccessfulAssignmentSave(prev, { type: "delete", rowId: row.id }));
        setSelectedId((current) => (current === row.id ? null : current));
      }

      for (const row of toUpdate) {
        const response = await fetch(`/api/org/mapping-assignments/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createSavePayload(row)),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as unknown;
          throw new Error(stringifyErrorDetail(payload) ?? `수정 실패: ${row.department_code} / ${row.item_code}`);
        }
        const payload = (await response.json().catch(() => null)) as { item?: OrgMappingAssignmentItem } | null;
        const savedRow = payload?.item;
        if (!savedRow) {
          throw new Error(`수정 응답이 올바르지 않습니다: ${row.department_code} / ${row.item_code}`);
        }
        commitRows((prev) =>
          applySuccessfulAssignmentSave(prev, { type: "upsert", previousId: row.id, row: savedRow }),
        );
        setSelectedId((current) => (current === row.id ? savedRow.id : current));
      }

      for (const row of toInsert) {
        const response = await fetch("/api/org/mapping-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createSavePayload(row)),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as unknown;
          throw new Error(stringifyErrorDetail(payload) ?? `입력 실패: ${row.department_code} / ${row.item_code}`);
        }
        const payload = (await response.json().catch(() => null)) as { item?: OrgMappingAssignmentItem } | null;
        const savedRow = payload?.item;
        if (!savedRow) {
          throw new Error(`입력 응답이 올바르지 않습니다: ${row.department_code} / ${row.item_code}`);
        }
        commitRows((prev) =>
          applySuccessfulAssignmentSave(prev, { type: "upsert", previousId: row.id, row: savedRow }),
        );
        setSelectedId((current) => (current === row.id ? savedRow.id : current));
      }

      toast.success(
        `${I18N.saveDone} (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`,
      );
      await runQuery(appliedFilters, page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.saveFail);
    } finally {
      setSaving(false);
    }
  }

  function applyAndQuery() {
    requestReloadAction({ type: "query", filters: { ...searchFilters } });
  }

  function handleSearchFieldEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyAndQuery();
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

  const toolbarActions = [
    {
      key: "create",
      label: I18N.addRow,
      icon: Plus,
      onClick: addRow,
      disabled: saving || loading || !canSaveAction,
    },
    {
      key: "copy",
      label: I18N.copy,
      icon: Copy,
      onClick: copyRow,
      disabled: saving || loading || !selectedRow || selectedRow._status === "deleted" || !canSaveAction,
    },
    {
      key: "download",
      label: I18N.download,
      icon: Download,
      onClick: () => void downloadXlsx(),
      disabled: saving || loading,
    },
  ].filter((action) => {
    if (action.key === "download") return can("download");
    if (action.key === "create") return canCreateAction;
    return canCopyAction;
  });

  const toolbarSaveAction = canSaveAction
    ? {
        key: "save",
        label: saving ? `${I18N.save}...` : I18N.save,
        icon: Save,
        onClick: () => void saveAll(),
        disabled: saving || loading || menuActionLoading,
        variant: "save" as const,
      }
    : undefined;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">{I18N.loading}</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection
        title={I18N.title}
        onQuery={applyAndQuery}
        queryLabel={I18N.query}
        queryDisabled={loading || saving || menuActionLoading || !can("query")}
      >
        <SearchFieldGrid className="xl:grid-cols-3">
          <select
            value={searchFilters.departmentId}
            onChange={(event) => setSearchFilters((prev) => ({ ...prev, departmentId: event.target.value }))}
            onKeyDown={handleSearchFieldEnter}
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            aria-label="부서"
          >
            <option value="">부서 전체</option>
            {departmentSelectOptions.map((department) => (
              <option key={department.value} value={department.value}>
                {department.label}
              </option>
            ))}
          </select>
          <select
            value={searchFilters.typeCode}
            onChange={(event) => setSearchFilters((prev) => ({ ...prev, typeCode: event.target.value }))}
            onKeyDown={handleSearchFieldEnter}
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            aria-label="유형"
          >
            <option value="">유형 전체</option>
            {typeOptions.map((type) => (
              <option key={type.code} value={type.code}>
                {type.code} / {type.name}
              </option>
            ))}
          </select>
          <CustomDatePicker
            value={searchFilters.referenceDate}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, referenceDate: value }))}
            placeholder="기준일"
            className="w-full"
            onKeyDown={handleSearchFieldEnter}
            ariaLabel="기준일"
          />
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
            <span className="text-xs text-muted-foreground">총 {totalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} />
          </>
        )}
        headerRight={<GridToolbarActions actions={toolbarActions} saveAction={toolbarSaveAction} />}
        contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-0"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-border">
          <AgGridReact<RowData>
            theme="legacy"
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => String(params.data.id)}
            rowSelection={{ mode: "singleRow", enableClickSelection: true }}
            singleClickEdit
            animateRows={false}
            rowClassRules={rowClassRules}
            getRowClass={getRowClass}
            loading={loading}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate={`<span class="text-sm text-muted-foreground">${I18N.noRows}</span>`}
            headerHeight={36}
            rowHeight={34}
            onGridReady={onGridReady}
            onRowClicked={(event) => {
              if (!event.data) return;
              setSelectedId(event.data.id);
            }}
            onCellValueChanged={onCellValueChanged}
          />
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
