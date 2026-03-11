"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, Copy, FileDown, Upload, Download, Save } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { SEARCH_PLACEHOLDERS } from "@/lib/grid/search-presets";
import { clearSavedStatuses, reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import {
  buildGridRowClassRules,
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { runConcurrentOrThrow } from "@/lib/utils/run-concurrent";
import type { OrganizationDepartmentItem, OrganizationDepartmentListResponse } from "@/types/organization";

// AG Grid modules are provided by ManagerPageShell via AgGridModulesProvider.

type RowStatus = GridRowStatus;

type OrgRow = OrganizationDepartmentItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

const TRACKED_FIELDS: (keyof OrganizationDepartmentItem)[] = [
  "code",
  "name",
  "parent_id",
  "is_active",
];

const I18N = {
  title: "조직코드관리",
  loading: "조직 데이터를 불러오는 중...",
  loadError: "조직 목록을 불러오지 못했습니다.",
  saveDone: "저장이 완료되었습니다.",
  saveFail: "저장에 실패했습니다.",
  noRows: "조직 데이터가 없습니다.",
  addRow: "입력",
  copy: "복사",
  templateDownload: "양식 다운로드",
  upload: "업로드",
  download: "다운로드",
  save: "저장",
  query: "조회",
  colDelete: "삭제",
  colStatus: "상태",
  colCode: "조직코드",
  colName: "조직명",
  colParentName: "상위조직",
  colActive: "사용",
  colUpdatedAt: "수정일",
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

function snapshotOriginal(row: OrganizationDepartmentItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isRevertedToOriginal(row: OrgRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: OrganizationDepartmentItem): OrgRow {
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

type SearchFilters = {
  code: string;
  name: string;
  referenceDate: string;
};

type PendingReloadAction =
  | { type: "page"; page: number }
  | { type: "query"; filters: SearchFilters };

const EMPTY_FILTERS: SearchFilters = { code: "", name: "", referenceDate: "" };

function createEmptyFilters(): SearchFilters {
  return { ...EMPTY_FILTERS };
}

export function OrganizationManager() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => createEmptyFilters());
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(() => createEmptyFilters());
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingReloadAction, setPendingReloadAction] = useState<PendingReloadAction | null>(null);

  const gridApiRef = useRef<GridApi<OrgRow> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tempIdRef = useRef(-1);
  const rowsRef = useRef<OrgRow[]>([]);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  const changeSummary = useMemo(
    () => summarizeGridStatuses(rows, (row) => row._status),
    [rows],
  );
  const hasDirtyRows = useMemo(() => rows.some((row) => row._status !== "clean"), [rows]);

  const getRowKey = useCallback((row: OrgRow) => String(row.id), []);

  const applyGridTransaction = useCallback(
    (prevRows: OrgRow[], nextRows: OrgRow[]) => {
      const api = gridApiRef.current;
      if (!api) return;

      const prevMap = new Map(prevRows.map((row) => [getRowKey(row), row]));
      const nextMap = new Map(nextRows.map((row) => [getRowKey(row), row]));
      const add: OrgRow[] = [];
      const update: OrgRow[] = [];
      const remove: OrgRow[] = [];

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
    (updater: (prevRows: OrgRow[]) => OrgRow[]) => {
      const prevRows = rowsRef.current;
      const nextRows = updater(prevRows);
      rowsRef.current = nextRows;
      setRows(nextRows);
      applyGridTransaction(prevRows, nextRows);
    },
    [applyGridTransaction],
  );

  const runReloadAction = useCallback((action: PendingReloadAction, discardDirtyRows: boolean) => {
    gridApiRef.current?.stopEditing();
    gridApiRef.current?.deselectAll();

    if (discardDirtyRows) {
      rowsRef.current = [];
      setRows([]);
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

  const fetchDepartments = useCallback(async (filters: SearchFilters, pageNo: number) => {
    const params = new URLSearchParams();
    params.set("page", String(pageNo));
    params.set("limit", String(pageSize));
    if (filters.code.trim()) params.set("code", filters.code.trim());
    if (filters.name.trim()) params.set("name", filters.name.trim());
    if (filters.referenceDate.trim()) params.set("reference_date", filters.referenceDate.trim());

    const endpoint =
      params.size > 0 ? `/api/org/departments?${params.toString()}` : "/api/org/departments";
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as unknown;
      throw new Error(stringifyErrorDetail(json) ?? I18N.loadError);
    }
    return (await response.json()) as OrganizationDepartmentListResponse;
  }, [pageSize]);

  const runQuery = useCallback(async (filters: SearchFilters, pageNo: number) => {
    setLoading(true);
    try {
      const response = await fetchDepartments(filters, pageNo);
      const nextRows = response.departments.map(toGridRow);
      rowsRef.current = nextRows;
      setRows(nextRows);
      setTotalCount(response.total_count ?? response.departments.length);
      setSelectedId(nextRows[0]?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.loadError);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [fetchDepartments]);

  useEffect(() => {
    void runQuery(appliedFilters, page);
    // appliedFilters only changes when the user explicitly clicks 조회 or presses Enter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, page]);

  useEffect(() => {
    const api = gridApiRef.current;
    if (!api) return;
    if (loading) {
      api.showLoadingOverlay();
      return;
    }
    if (rows.length === 0) {
      api.showNoRowsOverlay();
      return;
    }
    api.hideOverlay();
  }, [loading, rows.length]);

  const defaultColDef = useMemo<ColDef<OrgRow>>(
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

  const toggleDeleteById = useCallback(
    (rowId: number, checked: boolean) => {
      commitRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isRevertedToOriginal(candidate),
        }),
      );
    },
    [commitRows],
  );

  const columnDefs = useMemo<ColDef<OrgRow>[]>(
    () => [
      {
        headerName: I18N.colDelete,
        field: "_status",
        width: 62,
        pinned: "left",
        sortable: false,
        filter: false,
        editable: false,
        resizable: false,
        suppressMenu: true,
        cellRenderer: (params: ICellRendererParams<OrgRow>) => {
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
        headerName: I18N.colCode,
        field: "code",
        flex: 1,
        minWidth: 160,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colName,
        field: "name",
        flex: 1.2,
        minWidth: 180,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colParentName,
        field: "parent_name",
        editable: false,
        flex: 1.2,
        minWidth: 180,
      },
      {
        headerName: I18N.colActive,
        field: "is_active",
        width: 100,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (params) => (params.value ? "Y" : "N"),
        valueParser: (params) => params.newValue === "Y",
      },
      {
        headerName: I18N.colUpdatedAt,
        field: "updated_at",
        editable: false,
        minWidth: 180,
        valueFormatter: (params) => new Date(params.value).toLocaleString(),
      },
    ],
    [toggleDeleteById],
  );

  const getRowClass = useCallback((params: RowClassParams<OrgRow>) => {
    return getGridRowClass(params.data?._status);
  }, []);
  const rowClassRules = useMemo(() => buildGridRowClassRules<OrgRow>(), []);

  function addRow() {
    const newId = tempIdRef.current;
    tempIdRef.current -= 1;
    const now = new Date().toISOString();
    const newRow: OrgRow = {
      id: newId,
      code: "",
      name: "",
      parent_id: null,
      parent_name: null,
      is_active: true,
      created_at: now,
      updated_at: now,
      _status: "added",
    };

    commitRows((prev) => [newRow, ...prev]);
    setSelectedId(newId);
  }

  function copyRow() {
    if (!selectedRow) return;
    const newId = tempIdRef.current;
    tempIdRef.current -= 1;
    const now = new Date().toISOString();

    const copied: OrgRow = {
      ...selectedRow,
      id: newId,
      code: `${selectedRow.code}_COPY`,
      created_at: now,
      updated_at: now,
      _status: "added",
      _original: undefined,
    };

    commitRows((prev) => {
      const index = prev.findIndex((row) => row.id === selectedRow.id);
      if (index < 0) return [copied, ...prev];
      return [...prev.slice(0, index + 1), copied, ...prev.slice(index + 1)];
    });
    setSelectedId(newId);
  }

  function downloadTemplate() {
    toast.info("양식 다운로드는 다음 단계에서 연결됩니다.");
  }

  function uploadTemplate() {
    toast.info("업로드는 다음 단계에서 컬럼 매핑과 연결됩니다.");
  }

  const handlePasteCapture = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      const text = event.clipboardData.getData("text/plain");
      if (!text || !text.includes("\t")) return;

      event.preventDefault();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (lines.length === 0) return;

      const now = new Date().toISOString();
      const pastedRows: OrgRow[] = lines.map((line) => {
        const cols = line.split("\t").map((cell) => cell.trim());
        const rowId = tempIdRef.current;
        tempIdRef.current -= 1;
        return {
          id: rowId,
          code: cols[0] ?? "",
          name: cols[1] ?? "",
          parent_id: null,
          parent_name: cols[2] || null,
          is_active: (cols[3] ?? "Y").toUpperCase() !== "N",
          created_at: now,
          updated_at: now,
          _status: "added",
        };
      });

      commitRows((prev) => [...pastedRows, ...prev]);
      setSelectedId(pastedRows[0]?.id ?? null);
      toast.success(`붙여넣기 완료 (${pastedRows.length}건)`);
    },
    [commitRows],
  );

  async function downloadXlsx() {
    const exportRows = rows.map((row, index) => ({
      No: index + 1,
      삭제: row._status === "deleted" ? "Y" : "N",
      상태: STATUS_LABELS[row._status],
      조직코드: row.code,
      조직명: row.name,
      상위조직: row.parent_name ?? "",
      사용: row.is_active ? "Y" : "N",
      수정일: row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
    }));

    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "조직코드");
    XLSX.writeFile(workbook, "org-codes.xlsx");
  }

  async function saveAll() {
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated");

    if (toDelete.length + toInsert.length + toUpdate.length === 0) return;

    setSaving(true);
    try {
      await runConcurrentOrThrow(
        "삭제",
        toDelete.map((row) => async () => {
          const response = await fetch(`/api/org/departments/${row.id}`, { method: "DELETE" });
          if (!response.ok) throw new Error(`삭제 실패: ${row.code}`);
        }),
        6,
      );

      await runConcurrentOrThrow(
        "수정",
        toUpdate.map((row) => async () => {
          const response = await fetch(`/api/org/departments/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: row.code,
              name: row.name,
              parent_id: row.parent_id,
              is_active: row.is_active,
            }),
          });
          if (!response.ok) throw new Error(`수정 실패: ${row.code}`);
        }),
        6,
      );

      await runConcurrentOrThrow(
        "입력",
        toInsert.map((row) => async () => {
          const response = await fetch("/api/org/departments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: row.code,
              name: row.name,
              parent_id: row.parent_id,
              is_active: row.is_active,
            }),
          });
          if (!response.ok) throw new Error(`입력 실패: ${row.code || "(신규)"}`);
        }),
        6,
      );

      commitRows((prev) =>
        clearSavedStatuses(prev, {
          removeDeleted: true,
          buildOriginal: (row) => snapshotOriginal(row),
        }),
      );

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

  function handleSearchFieldEnter(event: React.KeyboardEvent<HTMLInputElement>) {
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
      key: "add",
      label: I18N.addRow,
      icon: Plus,
      onClick: addRow,
      disabled: saving,
    },
    {
      key: "copy",
      label: I18N.copy,
      icon: Copy,
      onClick: copyRow,
      disabled: saving || !selectedRow,
    },
    {
      key: "template",
      label: I18N.templateDownload,
      icon: FileDown,
      onClick: downloadTemplate,
      disabled: saving,
    },
    {
      key: "upload",
      label: I18N.upload,
      icon: Upload,
      onClick: uploadTemplate,
      disabled: saving,
    },
    {
      key: "download",
      label: I18N.download,
      icon: Download,
      onClick: () => void downloadXlsx(),
      disabled: saving,
    },
  ];

  const toolbarSaveAction = {
    key: "save",
    label: saving ? `${I18N.save}...` : I18N.save,
    icon: Save,
    onClick: () => void saveAll(),
    disabled: saving,
    variant: "save" as const,
  };

  const onGridReady = useCallback((event: GridReadyEvent<OrgRow>) => {
    gridApiRef.current = event.api;
  }, []);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<OrgRow>) => {
      if (event.newValue === event.oldValue) return;
      const rowId = event.data?.id;
      const field = event.colDef.field as keyof OrgRow | undefined;
      if (rowId == null || !field) return;

      commitRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const next = { ...row } as OrgRow;
          if (field === "code" || field === "name") {
            next[field] = String(event.newValue ?? "") as never;
          } else if (field === "is_active") {
            next.is_active =
              typeof event.newValue === "boolean"
                ? event.newValue
                : String(event.newValue ?? "N").toUpperCase() === "Y";
          } else {
            next[field] = event.newValue as never;
          }
          return reconcileUpdatedStatus(next, {
            shouldBeClean: (candidate) => isRevertedToOriginal(candidate),
          });
        }),
      );
    },
    [commitRows],
  );

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
        onQuery={applyAndQuery}
        queryLabel={I18N.query}
        queryDisabled={saving}
      >
        <SearchFieldGrid className="xl:grid-cols-3">
          <SearchTextField
            value={searchFilters.code}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, code: value }))}
            onKeyDown={handleSearchFieldEnter}
            placeholder={SEARCH_PLACEHOLDERS.organizationCode}
          />
          <SearchTextField
            value={searchFilters.name}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, name: value }))}
            onKeyDown={handleSearchFieldEnter}
            placeholder={SEARCH_PLACEHOLDERS.organizationName}
          />
          <CustomDatePicker
            value={searchFilters.referenceDate}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, referenceDate: value }))}
            placeholder={SEARCH_PLACEHOLDERS.referenceDate}
            className="w-full"
            onKeyDown={handleSearchFieldEnter}
            ariaLabel={SEARCH_PLACEHOLDERS.referenceDate}
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
            <span className="text-xs text-slate-500">총 {totalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} />
          </>
        )}
        headerRight={<GridToolbarActions actions={toolbarActions} saveAction={toolbarSaveAction} />}
        contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-0"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<OrgRow>
            theme="legacy"
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => String(params.data.id)}
            rowSelection="single"
            suppressRowClickSelection={false}
            singleClickEdit
            animateRows={false}
            rowClassRules={rowClassRules}
            getRowClass={getRowClass}
            loading={loading}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate={`<span class="text-sm text-slate-400">${I18N.noRows}</span>`}
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

