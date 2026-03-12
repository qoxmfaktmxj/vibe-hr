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
import { Copy, Download, FileDown, Plus, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  buildGridRowClassRules,
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
import { clearSavedStatuses, reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { isRowRevertedToOriginal, snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import { runConcurrentOrThrow } from "@/lib/utils/run-concurrent";
import type { PapAppraisalItem, PapAppraisalListResponse } from "@/types/pap-appraisal";
import type { PapFinalResultItem, PapFinalResultListResponse } from "@/types/pap-final-result";

type RowStatus = GridRowStatus;

type PapAppraisalRow = PapAppraisalItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

type SearchFilters = {
  code: string;
  name: string;
  year: string;
  active: "" | "Y" | "N";
};

type PendingReloadAction =
  | { type: "page"; page: number }
  | { type: "query"; filters: SearchFilters };

const TRACKED_FIELDS: (keyof PapAppraisalItem)[] = [
  "appraisal_code",
  "appraisal_name",
  "appraisal_year",
  "final_result_id",
  "appraisal_type",
  "start_date",
  "end_date",
  "is_active",
  "sort_order",
  "description",
];

const EMPTY_FILTERS: SearchFilters = { code: "", name: "", year: "", active: "" };

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

const I18N = {
  title: "평가기준관리",
  query: "조회",
  loading: "평가기준 데이터를 불러오는 중...",
  loadError: "평가기준 목록을 불러오지 못했습니다.",
  saveDone: "저장이 완료되었습니다.",
  saveFail: "저장에 실패했습니다.",
  noRows: "평가기준 데이터가 없습니다.",
  addRow: "입력",
  copy: "복사",
  templateDownload: "양식 다운로드",
  upload: "업로드",
  save: "저장",
  download: "다운로드",
};

const ACTION_CODE_BY_KEY: Record<string, string> = {
  create: "create",
  copy: "copy",
  template: "template_download",
  upload: "upload",
  download: "download",
};

function snapshotOriginal(row: PapAppraisalItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function toGridRow(row: PapAppraisalItem): PapAppraisalRow {
  return { ...row, _status: "clean", _original: snapshotOriginal(row), _prevStatus: undefined };
}

function isRevertedToOriginal(row: PapAppraisalRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function createEmptyRow(tempId: number): PapAppraisalRow {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return {
    id: tempId,
    appraisal_code: "",
    appraisal_name: "",
    appraisal_year: new Date().getFullYear(),
    final_result_id: null,
    final_result_code: null,
    final_result_name: null,
    appraisal_type: "annual",
    start_date: today,
    end_date: today,
    is_active: true,
    sort_order: 0,
    description: "",
    created_at: now,
    updated_at: now,
    _status: "added",
  };
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
}

export function PapAppraisalManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/pap/appraisals");
  const [rows, setRows] = useState<PapAppraisalRow[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingReloadAction, setPendingReloadAction] = useState<PendingReloadAction | null>(null);
  const [finalResults, setFinalResults] = useState<PapFinalResultItem[]>([]);

  const gridApiRef = useRef<GridApi<PapAppraisalRow> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);
  const rowsRef = useRef<PapAppraisalRow[]>([]);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);
  const hasDirtyRows = useMemo(() => rows.some((row) => row._status !== "clean"), [rows]);
  const rowClassRules = useMemo(() => buildGridRowClassRules<PapAppraisalRow>(), []);
  const finalResultLabelById = useMemo(
    () => new Map(finalResults.map((item) => [item.id, `${item.result_code} - ${item.result_name}`])),
    [finalResults],
  );
  const finalResultValueOptions = useMemo(() => ["", ...finalResults.map((item) => String(item.id))], [finalResults]);
  const finalResultById = useMemo(() => new Map(finalResults.map((item) => [item.id, item])), [finalResults]);
  const finalResultCodeToId = useMemo(
    () => new Map(finalResults.map((item) => [item.result_code.trim().toUpperCase(), item.id])),
    [finalResults],
  );

  const getRowKey = useCallback((row: PapAppraisalRow) => String(row.id), []);

  const applyGridTransaction = useCallback((prevRows: PapAppraisalRow[], nextRows: PapAppraisalRow[]) => {
    const api = gridApiRef.current;
    if (!api) return;

    const prevMap = new Map(prevRows.map((row) => [getRowKey(row), row]));
    const nextMap = new Map(nextRows.map((row) => [getRowKey(row), row]));
    const add: PapAppraisalRow[] = [];
    const update: PapAppraisalRow[] = [];
    const remove: PapAppraisalRow[] = [];

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
  }, [getRowKey]);

  const commitRows = useCallback((updater: (prevRows: PapAppraisalRow[]) => PapAppraisalRow[]) => {
    const prevRows = rowsRef.current;
    const nextRows = updater(prevRows);
    rowsRef.current = nextRows;
    setRows(nextRows);
    applyGridTransaction(prevRows, nextRows);
  }, [applyGridTransaction]);

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

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

  const requestReloadAction = useCallback((action: PendingReloadAction) => {
    if (action.type === "page" && action.page === page) return;
    if (hasDirtyRows) {
      setPendingReloadAction(action);
      setDiscardDialogOpen(true);
      return;
    }
    runReloadAction(action, false);
  }, [hasDirtyRows, page, runReloadAction]);

  const { totalPages, pageInput, setPageInput, goPrev, goNext, goToPage } = useGridPagination({
    page,
    totalCount,
    pageSize,
    onPageChange: (nextPage) => requestReloadAction({ type: "page", page: nextPage }),
  });

  const fetchRows = useCallback(async (filters: SearchFilters, pageNo: number) => {
    const params = new URLSearchParams();
    params.set("page", String(pageNo));
    params.set("limit", String(pageSize));
    if (filters.code.trim()) params.set("code", filters.code.trim());
    if (filters.name.trim()) params.set("name", filters.name.trim());
    if (filters.year.trim()) params.set("appraisal_year", filters.year.trim());
    if (filters.active === "Y") params.set("active_only", "true");
    if (filters.active === "N") params.set("active_only", "false");

    const response = await fetch(`/api/pap/appraisals?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await parseErrorDetail(response, I18N.loadError));
    }
    return (await response.json()) as PapAppraisalListResponse;
  }, [pageSize]);

  const loadFinalResults = useCallback(async () => {
    const response = await fetch("/api/pap/final-results?all=true&limit=500", { cache: "no-store" });
    if (response.status === 401 || response.status === 403) {
      setFinalResults([]);
      return;
    }
    if (!response.ok) {
      throw new Error(await parseErrorDetail(response, "최종등급 목록을 불러오지 못했습니다."));
    }
    const json = (await response.json()) as PapFinalResultListResponse;
    setFinalResults(json.items ?? []);
  }, []);

  const runQuery = useCallback(async (filters: SearchFilters, pageNo: number) => {
    setLoading(true);
    try {
      const response = await fetchRows(filters, pageNo);
      const nextRows = response.items.map(toGridRow);
      rowsRef.current = nextRows;
      setRows(nextRows);
      setTotalCount(response.total_count ?? response.items.length);
      setSelectedId(nextRows[0]?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.loadError);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [fetchRows]);

  useEffect(() => {
    void loadFinalResults();
  }, [loadFinalResults]);

  useEffect(() => {
    void runQuery(appliedFilters, page);
  }, [appliedFilters, page, runQuery]);

  const patchRow = useCallback((rowId: number, patch: Partial<PapAppraisalRow>) => {
    commitRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const merged: PapAppraisalRow = { ...row, ...patch, _original: row._original, _prevStatus: row._prevStatus };
        return reconcileUpdatedStatus(merged, { shouldBeClean: (candidate) => isRevertedToOriginal(candidate) });
      }),
    );
  }, [commitRows]);

  const addRow = useCallback(() => {
    commitRows((prev) => [createEmptyRow(issueTempId()), ...prev]);
  }, [commitRows, issueTempId]);

  const copyRow = useCallback(() => {
    if (!selectedRow || selectedRow._status === "deleted") {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }

    const now = new Date().toISOString();
    const clone: PapAppraisalRow = {
      ...selectedRow,
      id: issueTempId(),
      appraisal_code: `${selectedRow.appraisal_code}_COPY`,
      created_at: now,
      updated_at: now,
      _status: "added",
      _original: undefined,
      _prevStatus: undefined,
    };
    commitRows((prev) => [clone, ...prev]);
  }, [commitRows, issueTempId, selectedRow]);

  const toggleDeleteById = useCallback((rowId: number, checked: boolean) => {
    commitRows((prev) =>
      toggleDeletedStatus(prev, rowId, checked, {
        shouldBeClean: (candidate) => isRevertedToOriginal(candidate),
        removeAddedRow: true,
      }),
    );
  }, [commitRows]);

  const saveAll = useCallback(async () => {
    gridApiRef.current?.stopEditing();
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated" && row.id > 0);

    if (toDelete.length + toInsert.length + toUpdate.length === 0) {
      toast.info("변경된 데이터가 없습니다.");
      return;
    }

    for (const row of [...toInsert, ...toUpdate]) {
      if (!row.appraisal_code.trim()) return void toast.error("평가코드는 필수입니다.");
      if (!row.appraisal_name.trim()) return void toast.error("평가명은 필수입니다.");
      if (!Number.isFinite(Number(row.appraisal_year))) return void toast.error("평가연도는 필수입니다.");
      if (row.final_result_id == null) return void toast.error("최종등급은 필수입니다.");
    }

    setSaving(true);
    try {
      await runConcurrentOrThrow(
        "삭제",
        toDelete.map((row) => async () => {
          const response = await fetch(`/api/pap/appraisals/${row.id}`, { method: "DELETE" });
          if (!response.ok) throw new Error(await parseErrorDetail(response, `${row.appraisal_code} 삭제 실패`));
        }),
        6,
      );

      await runConcurrentOrThrow(
        "수정",
        toUpdate.map((row) => async () => {
          const response = await fetch(`/api/pap/appraisals/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appraisal_code: row.appraisal_code.trim(),
              appraisal_name: row.appraisal_name.trim(),
              appraisal_year: Number(row.appraisal_year),
              final_result_id: row.final_result_id,
              appraisal_type: row.appraisal_type || null,
              start_date: row.start_date || null,
              end_date: row.end_date || null,
              is_active: row.is_active,
              sort_order: Number(row.sort_order || 0),
              description: row.description || null,
            }),
          });
          if (!response.ok) throw new Error(await parseErrorDetail(response, `${row.appraisal_code} 수정 실패`));
        }),
        6,
      );

      await runConcurrentOrThrow(
        "입력",
        toInsert.map((row) => async () => {
          const response = await fetch("/api/pap/appraisals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appraisal_code: row.appraisal_code.trim(),
              appraisal_name: row.appraisal_name.trim(),
              appraisal_year: Number(row.appraisal_year),
              final_result_id: row.final_result_id,
              appraisal_type: row.appraisal_type || null,
              start_date: row.start_date || null,
              end_date: row.end_date || null,
              is_active: row.is_active,
              sort_order: Number(row.sort_order || 0),
              description: row.description || null,
            }),
          });
          if (!response.ok) throw new Error(await parseErrorDetail(response, `${row.appraisal_code || "(신규)"} 입력 실패`));
        }),
        6,
      );

      commitRows((prev) =>
        clearSavedStatuses(prev, {
          removeDeleted: true,
          buildOriginal: (row) => snapshotOriginal(row),
        }),
      );
      toast.success(`${I18N.saveDone} (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`);
      await runQuery(appliedFilters, page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.saveFail);
    } finally {
      setSaving(false);
    }
  }, [appliedFilters, commitRows, page, rows, runQuery]);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent<PapAppraisalRow>) => {
    if (event.newValue === event.oldValue) return;
    const rowId = event.data?.id;
    const field = event.colDef.field as keyof PapAppraisalRow | undefined;
    if (rowId == null || !field) return;

    commitRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row } as PapAppraisalRow;
        if (field === "appraisal_code" || field === "appraisal_name" || field === "appraisal_type" || field === "description") {
          next[field] = String(event.newValue ?? "") as never;
        } else if (field === "appraisal_year") {
          next.appraisal_year = Number(event.newValue || new Date().getFullYear());
        } else if (field === "start_date" || field === "end_date") {
          next[field] = String(event.newValue ?? "") as never;
        } else if (field === "sort_order") {
          next.sort_order = Number(event.newValue || 0);
        } else if (field === "final_result_id") {
          const parsed = String(event.newValue ?? "").trim();
          next.final_result_id = parsed ? Number(parsed) : null;
          const result = next.final_result_id != null ? finalResultById.get(next.final_result_id) : undefined;
          next.final_result_code = result?.result_code ?? null;
          next.final_result_name = result?.result_name ?? null;
        } else {
          next[field] = event.newValue as never;
        }
        return reconcileUpdatedStatus(next, {
          shouldBeClean: (candidate) => isRevertedToOriginal(candidate),
        });
      }),
    );
  }, [commitRows, finalResultById]);

  const columnDefs = useMemo<ColDef<PapAppraisalRow>[]>(() => [
    {
      headerName: "삭제",
      width: 56,
      pinned: "left",
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      editable: false,
      cellRenderer: (params: ICellRendererParams<PapAppraisalRow>) => {
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
      field: "_status",
      headerName: "상태",
      width: 84,
      pinned: "left",
      editable: false,
      cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
      valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
    },
    {
      field: "appraisal_code",
      headerName: "평가코드",
      minWidth: 140,
      pinned: "left",
      editable: (params) => params.data?._status !== "deleted",
    },
    {
      field: "appraisal_name",
      headerName: "평가명",
      minWidth: 180,
      editable: (params) => params.data?._status !== "deleted",
    },
    {
      field: "appraisal_year",
      headerName: "연도",
      width: 90,
      editable: (params) => params.data?._status !== "deleted",
      valueParser: (params) => Number(params.newValue || new Date().getFullYear()),
    },
    {
      field: "final_result_id",
      headerName: "최종등급",
      minWidth: 170,
      editable: (params) => params.data?._status !== "deleted",
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: finalResultValueOptions },
      valueParser: (params) => {
        const parsed = String(params.newValue ?? "").trim();
        return parsed ? Number(parsed) : null;
      },
      valueFormatter: (params) => {
        const value = Number(params.value);
        if (!Number.isFinite(value)) return "";
        return finalResultLabelById.get(value) ?? "";
      },
    },
    { field: "appraisal_type", headerName: "평가유형", width: 120, editable: (params) => params.data?._status !== "deleted" },
    { field: "start_date", headerName: "시작일", width: 120, editable: (params) => params.data?._status !== "deleted" },
    { field: "end_date", headerName: "종료일", width: 120, editable: (params) => params.data?._status !== "deleted" },
    {
      field: "sort_order",
      headerName: "정렬순서",
      width: 100,
      editable: (params) => params.data?._status !== "deleted",
      valueParser: (params) => Number(params.newValue || 0),
    },
    {
      field: "is_active",
      headerName: "사용",
      width: 90,
      editable: false,
      cellRenderer: (params: ICellRendererParams<PapAppraisalRow>) => {
        const row = params.data;
        if (!row) return null;
        return (
          <div className="flex h-full items-center justify-center">
            <input
              type="checkbox"
              checked={Boolean(row.is_active)}
              className="h-4 w-4 cursor-pointer accent-[var(--vibe-primary)]"
              disabled={row._status === "deleted"}
              onChange={(event) => patchRow(row.id, { is_active: event.target.checked })}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        );
      },
    },
    { field: "description", headerName: "설명", flex: 1, minWidth: 220, editable: (params) => params.data?._status !== "deleted" },
  ], [finalResultLabelById, finalResultValueOptions, patchRow, toggleDeleteById]);

  const defaultColDef = useMemo<ColDef<PapAppraisalRow>>(
    () => ({ sortable: true, filter: true, resizable: true, editable: false }),
    [],
  );

  const getRowClass = useCallback((params: RowClassParams<PapAppraisalRow>) => {
    return getGridRowClass(params.data?._status);
  }, []);

  const onGridReady = useCallback((event: GridReadyEvent<PapAppraisalRow>) => {
    gridApiRef.current = event.api;
  }, []);

  async function downloadTemplate() {
    try {
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([
        ["평가코드", "평가명", "연도", "최종등급코드", "평가유형", "시작일", "종료일", "정렬순서", "사용(Y/N)", "설명"],
        ["ANNUAL_2026", "2026 연간평가", "2026", "A", "annual", "2026-01-01", "2026-12-31", "10", "Y", "연간 평가 기준"],
      ]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "평가기준");
      writeFileXLSX(book, "pap-appraisals-template.xlsx");
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }

  async function downloadXlsx() {
    try {
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([
        ["상태", "평가코드", "평가명", "연도", "최종등급코드", "평가유형", "시작일", "종료일", "정렬순서", "사용", "설명"],
        ...rows.map((row) => [
          row._status,
          row.appraisal_code,
          row.appraisal_name,
          row.appraisal_year,
          row.final_result_code ?? "",
          row.appraisal_type ?? "",
          row.start_date ?? "",
          row.end_date ?? "",
          row.sort_order,
          row.is_active ? "Y" : "N",
          row.description ?? "",
        ]),
      ]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "평가기준관리");
      writeFileXLSX(book, `pap-appraisals-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }

  async function handleUploadFile(file: File) {
    try {
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1, raw: false });
      if (!rowsAoa || rowsAoa.length <= 1) return;

      const parsed = rowsAoa.slice(1)
        .map((cells) => cells.map((value) => String(value ?? "").trim()))
        .filter((cells) => cells.some((value) => value.length > 0))
        .map<PapAppraisalRow>((cells) => {
          const finalResultCode = (cells[3] ?? "").toUpperCase();
          const finalResultId = finalResultCodeToId.get(finalResultCode) ?? null;
          const finalResult = finalResultId != null ? finalResultById.get(finalResultId) : undefined;

          return {
            ...createEmptyRow(issueTempId()),
            appraisal_code: cells[0] ?? "",
            appraisal_name: cells[1] ?? "",
            appraisal_year: Number(cells[2] || new Date().getFullYear()),
            final_result_id: finalResultId,
            final_result_code: finalResult?.result_code ?? null,
            final_result_name: finalResult?.result_name ?? null,
            appraisal_type: cells[4] || "",
            start_date: cells[5] || "",
            end_date: cells[6] || "",
            sort_order: Number(cells[7] || 0),
            is_active: ["y", "true", "1"].includes((cells[8] ?? "").toLowerCase()),
            description: cells[9] ?? "",
          };
        });

      if (parsed.length === 0) {
        toast.error("업로드할 유효 데이터가 없습니다.");
        return;
      }

      commitRows((prev) => [...parsed, ...prev]);
      toast.success(`${parsed.length}건 업로드 반영 완료`);
    } catch {
      toast.error("업로드에 실패했습니다.");
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
    { key: "create", label: I18N.addRow, icon: Plus, onClick: addRow, disabled: saving },
    { key: "copy", label: I18N.copy, icon: Copy, onClick: copyRow, disabled: saving || !selectedRow },
    { key: "template", label: I18N.templateDownload, icon: FileDown, onClick: () => void downloadTemplate(), disabled: saving },
    { key: "upload", label: I18N.upload, icon: Upload, onClick: () => uploadInputRef.current?.click(), disabled: saving },
    { key: "download", label: I18N.download, icon: Download, onClick: () => void downloadXlsx(), disabled: saving },
  ].filter((action) => can(ACTION_CODE_BY_KEY[action.key] ?? action.key));

  const toolbarSaveAction = can("save")
    ? {
        key: "save",
        label: saving ? `${I18N.save}...` : I18N.save,
        icon: Save,
        onClick: () => void saveAll(),
        disabled: saving || menuActionLoading,
        variant: "save" as const,
      }
    : undefined;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">{I18N.loading}</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection
        title={I18N.title}
        onQuery={applyAndQuery}
        queryLabel={I18N.query}
        queryDisabled={saving || menuActionLoading || !can("query")}
      >
        <SearchFieldGrid className="xl:grid-cols-4">
          <SearchTextField value={searchFilters.code} onChange={(value) => setSearchFilters((prev) => ({ ...prev, code: value }))} onKeyDown={handleSearchFieldEnter} placeholder="평가코드" />
          <SearchTextField value={searchFilters.name} onChange={(value) => setSearchFilters((prev) => ({ ...prev, name: value }))} onKeyDown={handleSearchFieldEnter} placeholder="평가명" />
          <SearchTextField value={searchFilters.year} onChange={(value) => setSearchFilters((prev) => ({ ...prev, year: value }))} onKeyDown={handleSearchFieldEnter} placeholder="평가연도" />
          <select
            value={searchFilters.active}
            onChange={(event) => setSearchFilters((prev) => ({ ...prev, active: event.target.value as SearchFilters["active"] }))}
            onKeyDown={handleSearchFieldEnter}
            aria-label="사용여부"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">전체</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={(
          <>
            <GridPaginationControls page={page} totalPages={totalPages} pageInput={pageInput} setPageInput={setPageInput} goPrev={goPrev} goNext={goNext} goToPage={goToPage} disabled={loading || saving} className="mt-0 justify-start" />
            <span className="text-xs text-slate-500">총 {totalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} />
          </>
        )}
        headerRight={<GridToolbarActions actions={toolbarActions} saveAction={toolbarSaveAction} />}
        contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-0"
      >
        <input
          ref={uploadInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUploadFile(file);
            event.currentTarget.value = "";
          }}
        />
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<PapAppraisalRow>
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
