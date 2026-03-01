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

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Input } from "@/components/ui/input";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { SEARCH_PLACEHOLDERS } from "@/lib/grid/search-presets";
import { clearSavedStatuses, reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import {
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
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

const EMPTY_FILTERS: SearchFilters = { code: "", name: "", referenceDate: "" };

export function OrganizationManager() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const gridApiRef = useRef<GridApi<OrgRow> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tempIdRef = useRef(-1);
  const rowsRef = useRef<OrgRow[]>([]);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  const changeSummary = useMemo(
    () => summarizeGridStatuses(rows, (row) => row._status),
    [rows],
  );

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

  const fetchDepartments = useCallback(async (filters: SearchFilters) => {
    const params = new URLSearchParams();
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
    const data = (await response.json()) as OrganizationDepartmentListResponse;
    return data.departments;
  }, []);

  const runQuery = useCallback(async (filters: SearchFilters) => {
    setLoading(true);
    try {
      const departments = await fetchDepartments(filters);
      const nextRows = departments.map(toGridRow);
      rowsRef.current = nextRows;
      setRows(nextRows);
      setSelectedId(nextRows[0]?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.loadError);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [fetchDepartments]);

  useEffect(() => {
    void runQuery(appliedFilters);
    // appliedFilters only changes when the user explicitly clicks 조회 or presses Enter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

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
      await runQuery(appliedFilters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.saveFail);
    } finally {
      setSaving(false);
    }
  }

  function applyAndQuery() {
    setAppliedFilters(searchFilters);
  }

  function handleSearchFieldEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyAndQuery();
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
          const next = { ...row, [field]: event.newValue } as OrgRow;
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
          <Input
            type="date"
            className="h-9 text-sm"
            value={searchFilters.referenceDate}
            onChange={(event) => setSearchFilters((prev) => ({ ...prev, referenceDate: event.target.value }))}
            onKeyDown={handleSearchFieldEnter}
            aria-label={SEARCH_PLACEHOLDERS.referenceDate}
          />
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={<GridChangeSummaryBadges summary={changeSummary} className="ml-1" />}
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
    </ManagerPageShell>
  );
}

