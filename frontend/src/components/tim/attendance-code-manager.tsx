"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Copy, Save, Download, Search } from "lucide-react";
import { toast } from "sonner";

import {
  type CellValueChangedEvent,
  type ICellRendererParams,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  TimAttendanceCodeItem,
  TimAttendanceCodeBatchRequest,
  TimAttendanceCodeBatchResponse,
} from "@/types/tim";


/* ------------------------------------------------------------------ */
/* 타입                                                                */
/* ------------------------------------------------------------------ */
type RowStatus = GridRowStatus;

type AttendanceCodeRow = TimAttendanceCodeItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

/* ------------------------------------------------------------------ */
/* 상수                                                                */
/* ------------------------------------------------------------------ */
const TRACKED_FIELDS: (keyof TimAttendanceCodeItem)[] = [
  "code", "name", "category", "unit", "is_requestable",
  "min_days", "max_days", "deduct_annual", "is_active", "sort_order", "description",
];

const CATEGORY_OPTIONS = ["leave", "work", "special"];
const CATEGORY_LABELS: Record<string, string> = { leave: "휴가", work: "근무", special: "특별" };
const UNIT_OPTIONS = ["day", "am", "pm", "hour"];
const UNIT_LABELS: Record<string, string> = { day: "전일", am: "오전", pm: "오후", hour: "시간" };

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "", added: "입력", updated: "수정", deleted: "삭제",
};

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지", more: "더보기", to: "~", of: "/",
  next: "다음", last: "마지막", first: "처음", previous: "이전",
  loadingOoo: "로딩 중...", noRowsToShow: "데이터가 없습니다.",
  searchOoo: "검색...", blanks: "(빈값)", filterOoo: "필터...",
  applyFilter: "적용", equals: "같음", notEqual: "같지 않음",
  contains: "포함", notContains: "미포함", startsWith: "시작", endsWith: "끝",
  andCondition: "그리고", orCondition: "또는",
  selectAll: "전체 선택", noMatches: "일치 항목 없음",
};

const ACTION_CODE_BY_KEY: Record<string, string> = {
  create: "create",
  copy: "copy",
  template: "template_download",
  upload: "upload",
  download: "download",
};

/* ------------------------------------------------------------------ */
/* 보조 함수                                                           */
/* ------------------------------------------------------------------ */
function snapshotOriginal(row: TimAttendanceCodeItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isReverted(row: AttendanceCodeRow): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: TimAttendanceCodeItem): AttendanceCodeRow {
  return { ...item, _status: "clean", _original: snapshotOriginal(item) };
}

function createEmptyRow(tempId: number): AttendanceCodeRow {
  const now = new Date().toISOString();
  return {
    id: tempId,
    code: "",
    name: "",
    category: "leave",
    unit: "day",
    is_requestable: true,
    min_days: null,
    max_days: null,
    deduct_annual: false,
    is_active: true,
    sort_order: 0,
    description: null,
    created_at: now,
    updated_at: now,
    _status: "added",
  };
}

/* ------------------------------------------------------------------ */
/* 컴포넌트                                                            */
/* ------------------------------------------------------------------ */
export function AttendanceCodeManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/tim/codes");
  const [rows, setRows] = useState<AttendanceCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [appliedName, setAppliedName] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [page, setPage] = useState(1);
  const [gridMountKey, setGridMountKey] = useState(0);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(false);

  const gridApiRef = useRef<GridApi<AttendanceCodeRow> | null>(null);
  const tempIdRef = useRef(-1);
  const rowsRef = useRef<AttendanceCodeRow[]>([]);
  const pageSize = 100;

  const issueTempId = () => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  };

  /* -- 변경 요약 ---------------------------------------------------- */
  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);
  const hasChanges = useMemo(() => rows.some((row) => row._status !== "clean"), [rows]);
  const rowClassRules = useMemo(() => buildGridRowClassRules<AttendanceCodeRow>(), []);

  /* -- 로딩 -------------------------------------------------------- */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tim/attendance-codes", { cache: "no-store" });
      if (!res.ok) throw new Error("근태코드 목록을 불러오지 못했습니다.");
      const data = (await res.json()) as { items: TimAttendanceCodeItem[] };
      const nextRows = data.items.map(toGridRow);
      rowsRef.current = nextRows;
      setRows(nextRows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  /* -- 그리드 행 다시그리기 ---------------------------------------- */
  const getRowKey = useCallback((row: AttendanceCodeRow) => String(row.id), []);

  const applyGridTransaction = useCallback(
    (prevRows: AttendanceCodeRow[], nextRows: AttendanceCodeRow[]) => {
      const api = gridApiRef.current;
      if (!api) return;

      const prevMap = new Map(prevRows.map((row) => [getRowKey(row), row]));
      const nextMap = new Map(nextRows.map((row) => [getRowKey(row), row]));
      const add: AttendanceCodeRow[] = [];
      const update: AttendanceCodeRow[] = [];
      const remove: AttendanceCodeRow[] = [];

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
    (updater: (prevRows: AttendanceCodeRow[]) => AttendanceCodeRow[]) => {
      const prevRows = rowsRef.current;
      const nextRows = updater(prevRows);
      rowsRef.current = nextRows;
      setRows(nextRows);
      applyGridTransaction(prevRows, nextRows);
    },
    [applyGridTransaction],
  );

  /* -- 삭제 체크박스 토글 ----------------------------------------- */
  const toggleDelete = useCallback(
    (rowId: number, checked: boolean) => {
      commitRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          shouldBeClean: (candidate) => isReverted(candidate),
          removeAddedRow: true,
        }),
      );
    },
    [commitRows],
  );

  /* -- 컬럼 정의 --------------------------------------------------- */
  const columnDefs = useMemo<ColDef<AttendanceCodeRow>[]>(
    () => [
      {
        headerName: "삭제",
        width: 52,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        resizable: false,
        editable: false,
        cellRenderer: (params: ICellRendererParams<AttendanceCodeRow>) => {
          const row = params.data;
          if (!row) return null;
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={row._status === "deleted"}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)]"
                onChange={(e) => toggleDelete(row.id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        },
      },
      {
        headerName: "상태",
        field: "_status",
        width: 68,
        editable: false,
        sortable: false,
        filter: false,
        cellClass: (p) => getGridStatusCellClass(p.value as RowStatus),
        valueFormatter: (p) => STATUS_LABELS[(p.value as RowStatus) ?? "clean"],
      },
      {
        headerName: "근태코드",
        field: "code",
        width: 110,
        editable: (p) => p.data?._status === "added",
      },
      {
        headerName: "근태명",
        field: "name",
        flex: 1,
        minWidth: 140,
        editable: (p) => p.data?._status !== "deleted",
      },
      {
        headerName: "분류",
        field: "category",
        width: 90,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: CATEGORY_OPTIONS },
        valueFormatter: (p) => CATEGORY_LABELS[p.value as string] ?? (p.value as string),
      },
      {
        headerName: "신청단위",
        field: "unit",
        width: 90,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: UNIT_OPTIONS },
        valueFormatter: (p) => UNIT_LABELS[p.value as string] ?? (p.value as string),
      },
      {
        headerName: "신청가능",
        field: "is_requestable",
        width: 88,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (p) => (p.value ? "Y" : "N"),
        valueParser: (p) => p.newValue === "Y",
        cellStyle: { textAlign: "center" },
      },
      {
        headerName: "최소일수",
        field: "min_days",
        width: 90,
        editable: (p) => p.data?._status !== "deleted",
        cellStyle: { textAlign: "right" },
        valueFormatter: (p) => (p.value != null ? String(p.value) : "-"),
        valueParser: (p) => {
          const v = parseFloat(p.newValue);
          return isNaN(v) ? null : v;
        },
      },
      {
        headerName: "최대일수",
        field: "max_days",
        width: 90,
        editable: (p) => p.data?._status !== "deleted",
        cellStyle: { textAlign: "right" },
        valueFormatter: (p) => (p.value != null ? String(p.value) : "-"),
        valueParser: (p) => {
          const v = parseFloat(p.newValue);
          return isNaN(v) ? null : v;
        },
      },
      {
        headerName: "연차차감",
        field: "deduct_annual",
        width: 88,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (p) => (p.value ? "Y" : "N"),
        valueParser: (p) => p.newValue === "Y",
        cellStyle: { textAlign: "center" },
      },
      {
        headerName: "순서",
        field: "sort_order",
        width: 72,
        editable: (p) => p.data?._status !== "deleted",
        cellStyle: { textAlign: "right" },
        valueParser: (p) => parseInt(p.newValue, 10) || 0,
      },
      {
        headerName: "사용",
        field: "is_active",
        width: 68,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (p) => (p.value ? "Y" : "N"),
        valueParser: (p) => p.newValue === "Y",
        cellStyle: { textAlign: "center" },
      },
      {
        headerName: "설명",
        field: "description",
        flex: 1,
        minWidth: 160,
        editable: (p) => p.data?._status !== "deleted",
        valueFormatter: (p) => (p.value as string | null) ?? "",
      },
    ],
    [toggleDelete],
  );

  const defaultColDef = useMemo<ColDef<AttendanceCodeRow>>(
    () => ({ sortable: true, filter: true, resizable: true, editable: false }),
    [],
  );
  const selectionColumnDef = useMemo<ColDef<AttendanceCodeRow>>(
    () => ({
      width: 52,
      pinned: "left",
      sortable: false,
      filter: false,
      resizable: false,
      suppressHeaderMenuButton: true,
    }),
    [],
  );

  /* -- 행 스타일 --------------------------------------------------- */
  /* -- 그리드 이벤트 ----------------------------------------------- */
  const onGridReady = useCallback((e: GridReadyEvent<AttendanceCodeRow>) => {
    gridApiRef.current = e.api;
  }, []);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<AttendanceCodeRow>) => {
      if (e.newValue === e.oldValue) return;
      const rowId = e.data?.id;
      if (rowId == null) return;
      commitRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          return reconcileUpdatedStatus({ ...row } as AttendanceCodeRow, {
            shouldBeClean: (candidate) => isReverted(candidate),
          });
        }),
      );
    },
    [commitRows],
  );

  /* -- 액션 -------------------------------------------------------- */
  function addRow() {
    const row = createEmptyRow(issueTempId());
    commitRows((prev) => [row, ...prev]);
  }

  function copySelectedRows() {
    if (!gridApiRef.current) return;
    const selected = gridApiRef.current.getSelectedRows().filter((r) => r._status !== "deleted");
    if (selected.length === 0) return;
    const selectedIdSet = new Set(selected.map((r) => r.id));
    const clones = new Map(
      selected.map((r) => [
        r.id,
        { ...r, id: issueTempId(), code: "", _status: "added" as const, _original: undefined, _prevStatus: undefined },
      ]),
    );
    commitRows((prev) => {
      const next: AttendanceCodeRow[] = [];
      for (const row of prev) {
        next.push(row);
        if (selectedIdSet.has(row.id)) {
          const clone = clones.get(row.id);
          if (clone) next.push(clone);
        }
      }
      return next;
    });
  }

  async function downloadExcel() {
    try {
      const headers = ["근태코드", "근태명", "분류", "단위", "신청가능", "최소일수", "최대일수", "연차차감", "사용여부", "설명"];
      const data = rows
        .filter((r) => r._status !== "deleted")
        .map((r) => [
          r.code, r.name,
          CATEGORY_LABELS[r.category] ?? r.category,
          UNIT_LABELS[r.unit] ?? r.unit,
          r.is_requestable ? "Y" : "N",
          r.min_days ?? "",
          r.max_days ?? "",
          r.deduct_annual ? "Y" : "N",
          r.is_active ? "Y" : "N",
          r.description ?? "",
        ]);
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...data]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "근태코드");
      writeFileXLSX(book, `attendance-codes-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }

  async function handleQuery() {
    setAppliedName(searchName);
    setAppliedCategory(searchCategory);
    await loadData();
    tempIdRef.current = -1;
    gridApiRef.current = null;
    setGridMountKey((k) => k + 1);
    setPage(1);
  }

  function handleQueryRequest() {
    gridApiRef.current?.stopEditing();
    if (hasChanges) {
      setPendingQuery(true);
      setDiscardDialogOpen(true);
      return;
    }
    void handleQuery();
  }

  async function saveAllChanges() {
    const toInsert = rows.filter((r) => r._status === "added");
    const toUpdate = rows.filter((r) => r._status === "updated");
    const toDelete = rows.filter((r) => r._status === "deleted" && r.id > 0);

    if (toInsert.length + toUpdate.length + toDelete.length === 0) return;

    // 필수값 검증
    for (const r of [...toInsert, ...toUpdate]) {
      if (!r.code.trim()) { toast.error(`근태코드를 입력해 주세요. (행 ID: ${r.id})`); return; }
      if (!r.name.trim()) { toast.error(`근태명을 입력해 주세요. (코드: ${r.code})`); return; }
    }

    setSaving(true);
    try {
      const payload: TimAttendanceCodeBatchRequest = {
        items: [...toInsert, ...toUpdate].map((r) => ({
          id: r.id > 0 ? r.id : null,
          code: r.code.trim().toUpperCase(),
          name: r.name.trim(),
          category: r.category,
          unit: r.unit,
          is_requestable: r.is_requestable,
          min_days: r.min_days,
          max_days: r.max_days,
          deduct_annual: r.deduct_annual,
          is_active: r.is_active,
          sort_order: r.sort_order,
          description: r.description,
        })),
        delete_ids: toDelete.map((r) => r.id),
      };

      const res = await fetch("/api/tim/attendance-codes/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "저장에 실패했습니다.");
        return;
      }

      const json = (await res.json()) as TimAttendanceCodeBatchResponse;
      const nextRows = json.items.map(toGridRow);
      rowsRef.current = nextRows;
      setRows(nextRows);
      gridApiRef.current = null;
      setGridMountKey((k) => k + 1);
      toast.success(
        `저장 완료 (입력 ${json.inserted_count}건 / 수정 ${json.updated_count}건 / 삭제 ${json.deleted_count}건)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  /* -- 필터링 ------------------------------------------------------ */
  const filteredRows = useMemo(() => {
    const name = appliedName.trim().toLowerCase();
    const cat = appliedCategory;
    return rows.filter((r) => {
      if (name && !r.name.toLowerCase().includes(name) && !r.code.toLowerCase().includes(name)) return false;
      if (cat && r.category !== cat) return false;
      return true;
    });
  }, [rows, appliedName, appliedCategory]);
  const totalCount = filteredRows.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);
  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

  function handleTemplateDownload() {
    toast.success("양식 다운로드는 다음 단계에서 연결합니다.");
  }

  function handleUpload() {
    toast.success("업로드는 다음 단계에서 연결합니다.");
  }

  const toolbarActions = [
    { key: "create", label: "입력", icon: Plus, onClick: addRow },
    { key: "copy", label: "복사", icon: Copy, onClick: copySelectedRows },
    { key: "template", label: "양식 다운로드", icon: Search, onClick: handleTemplateDownload },
    { key: "upload", label: "업로드", icon: Search, onClick: handleUpload },
    { key: "download", label: "다운로드", icon: Download, onClick: () => void downloadExcel() },
  ].filter((action) => can(ACTION_CODE_BY_KEY[action.key] ?? action.key));

  const toolbarSaveAction = can("save")
    ? {
        key: "save",
        label: saving ? "저장중..." : "저장",
        icon: Save,
        onClick: () => void saveAllChanges(),
        disabled: saving || menuActionLoading,
        variant: "save" as const,
      }
    : undefined;

  /* -- 렌더링 ------------------------------------------------------ */
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">근태코드 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection
        title="근태코드관리"
        onQuery={handleQueryRequest}
        queryDisabled={saving || menuActionLoading || !can("query")}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">근태명/코드</div>
            <Input
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleQueryRequest(); }}
              placeholder="근태명 또는 코드"
              className="h-9 w-48 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">분류</div>
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleQueryRequest(); }}
              className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">전체</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={
          <>
            <GridPaginationControls page={page} totalPages={pagination.totalPages} pageInput={pagination.pageInput} setPageInput={pagination.setPageInput} goPrev={pagination.goPrev} goNext={pagination.goNext} goToPage={pagination.goToPage} />
            <span className="text-xs text-slate-400">총 {totalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} />
          </>
        }
        headerRight={
          <GridToolbarActions
            actions={toolbarActions}
            saveAction={toolbarSaveAction}
          />
        }
        contentClassName="min-h-0 flex-1 px-6 pb-4"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<AttendanceCodeRow>
            theme="legacy"
            key={gridMountKey}
            rowData={pagedRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection={{ mode: "multiRow" }}
            selectionColumnDef={selectionColumnDef}
            animateRows={false}
            rowClassRules={rowClassRules}
            getRowClass={(params) => getGridRowClass(params.data?._status)}
            getRowId={(p) => String(p.data.id)}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate='<span class="text-sm text-slate-400">근태코드 데이터가 없습니다.</span>'
            headerHeight={36}
            rowHeight={34}
          />
        </div>
      </ManagerGridSection>

      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title="저장되지 않은 변경 사항이 있습니다."
        description="현재 변경 내용을 저장하지 않고 이동하면 수정 내용이 사라집니다. 계속 진행하시겠습니까?"
        confirmLabel="무시하고 이동"
        cancelLabel="취소"
        onConfirm={() => {
          setDiscardDialogOpen(false);
          if (pendingQuery) {
            setPendingQuery(false);
            void handleQuery();
          }
        }}
      />
    </ManagerPageShell>
  );
}

