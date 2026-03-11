"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Plus, Save, Search } from "lucide-react";
import { toast } from "sonner";

import {
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { isRowRevertedToOriginal, snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import type { PayVariableInputBatchRequest, PayVariableInputBatchResponse, PayVariableInputItem } from "@/types/pay";

type RowStatus = GridRowStatus;

type RowData = PayVariableInputItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

const TRACKED_FIELDS: (keyof PayVariableInputItem)[] = ["year_month", "employee_id", "item_code", "direction", "amount", "memo"];

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

function snapshotOriginal(row: PayVariableInputItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isReverted(row: RowData): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: PayVariableInputItem): RowData {
  return { ...item, _status: "clean", _original: snapshotOriginal(item) };
}

function createEmptyRow(tempId: number, yearMonth: string): RowData {
  const now = new Date().toISOString();
  return {
    id: tempId,
    year_month: yearMonth,
    employee_id: 0,
    employee_no: null,
    employee_name: null,
    item_code: "",
    item_name: null,
    direction: "earning",
    amount: 0,
    memo: null,
    created_at: now,
    updated_at: now,
    _status: "added",
  };
}

export function PayVariableInputManager() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchYearMonth, setSearchYearMonth] = useState(currentMonth);
  const [appliedYearMonth, setAppliedYearMonth] = useState(currentMonth);
  const [page, setPage] = useState(1);
  const [gridMountKey, setGridMountKey] = useState(0);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(false);

  const gridApiRef = useRef<GridApi<RowData> | null>(null);
  const rowsRef = useRef<RowData[]>([]);
  const tempIdRef = useRef(-1);
  const pageSize = 100;

  const issueTempId = () => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  };

  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);
  const hasChanges = useMemo(() => rows.some((row) => row._status !== "clean"), [rows]);
  const rowClassRules = useMemo(() => buildGridRowClassRules<RowData>(), []);

  const loadData = useCallback(async (yearMonth: string) => {
    setLoading(true);
    try {
      const q = yearMonth ? `?year_month=${encodeURIComponent(yearMonth)}` : "";
      const res = await fetch(`/api/pay/variable-inputs${q}`, { cache: "no-store" });
      if (!res.ok) throw new Error("월 변동입력 목록을 불러오지 못했습니다.");
      const data = (await res.json()) as { items: PayVariableInputItem[] };
      const nextRows = (data.items ?? []).map(toGridRow);
      rowsRef.current = nextRows;
      setRows(nextRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(appliedYearMonth);
  }, [loadData, appliedYearMonth]);

  const commitRows = useCallback((updater: (prev: RowData[]) => RowData[]) => {
    const nextRows = updater(rowsRef.current);
    rowsRef.current = nextRows;
    setRows(nextRows);
  }, []);

  const addRow = useCallback(() => {
    commitRows((prev) => [createEmptyRow(issueTempId(), appliedYearMonth || currentMonth), ...prev]);
  }, [appliedYearMonth, commitRows, currentMonth]);

  const copySelectedRows = useCallback(() => {
    const selected = gridApiRef.current?.getSelectedRows() ?? [];
    if (selected.length === 0) {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }

    const copied = selected.map((row) => {
      const now = new Date().toISOString();
      return {
        ...row,
        id: issueTempId(),
        employee_no: null,
        employee_name: null,
        created_at: now,
        updated_at: now,
        _status: "added" as RowStatus,
      };
    });

    commitRows((prev) => [...copied, ...prev]);
  }, [commitRows]);

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

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<RowData>) => {
      if (event.newValue === event.oldValue) return;
      const rowId = event.data?.id;
      const field = event.colDef.field as keyof RowData | undefined;
      if (rowId == null || !field) return;

      commitRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const next = { ...row, [field]: event.newValue } as RowData;
          return reconcileUpdatedStatus(next, {
            shouldBeClean: (candidate) => isReverted(candidate),
          });
        }),
      );
    },
    [commitRows],
  );

  const onGridReady = useCallback((event: GridReadyEvent<RowData>) => {
    gridApiRef.current = event.api;
  }, []);

  async function handleQuery() {
    const next = searchYearMonth.trim();
    setAppliedYearMonth(next);
    setPage(1);
  }

  function handleQueryRequest() {
    if (hasChanges) {
      setPendingQuery(true);
      setDiscardDialogOpen(true);
      return;
    }
    void handleQuery();
  }

  async function saveAllChanges() {
    const delete_ids = rows.filter((row) => row._status === "deleted" && row.id > 0).map((row) => row.id);
    const items = rows
      .filter((row) => row._status !== "clean" && row._status !== "deleted")
      .map((row) => ({
        id: row.id > 0 ? row.id : undefined,
        year_month: String(row.year_month || "").trim(),
        employee_id: Number(row.employee_id || 0),
        item_code: String(row.item_code || "").trim(),
        direction: String(row.direction || "earning").trim(),
        amount: Number(row.amount || 0),
        memo: row.memo ? String(row.memo) : null,
      }));

    if (items.length === 0 && delete_ids.length === 0) {
      toast.error("저장할 변경사항이 없습니다.");
      return;
    }

    const invalid = items.find((item) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.year_month) || item.employee_id <= 0 || !item.item_code);
    if (invalid) {
      toast.error("year_month(YYYY-MM), employee_id, item_code는 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const payload: PayVariableInputBatchRequest = { items, delete_ids };
      const res = await fetch("/api/pay/variable-inputs/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "저장에 실패했습니다.");
        return;
      }

      const json = (await res.json()) as PayVariableInputBatchResponse;
      const nextRows = json.items.map(toGridRow);
      rowsRef.current = nextRows;
      setRows(nextRows);
      gridApiRef.current = null;
      setGridMountKey((prev) => prev + 1);
      toast.success(`저장 완료 (입력 ${json.inserted_count}건 / 수정 ${json.updated_count}건 / 삭제 ${json.deleted_count}건)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  const totalCount = rows.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);
  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

  const defaultColDef = useMemo<ColDef<RowData>>(
    () => ({
      editable: (params) => params.data?._status !== "deleted",
      sortable: true,
      resizable: true,
      filter: false,
      singleClickEdit: true,
    }),
    [],
  );

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      {
        headerName: "삭제",
        width: 52,
        pinned: "left",
        sortable: false,
        editable: false,
        cellRenderer: (params: ICellRendererParams<RowData>) => {
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
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
      },
      { headerName: "귀속월", field: "year_month", width: 100 },
      { headerName: "사번", field: "employee_no", width: 110, editable: false },
      { headerName: "이름", field: "employee_name", width: 120, editable: false },
      { headerName: "employee_id", field: "employee_id", width: 110, valueParser: (p) => Number(p.newValue) || 0 },
      { headerName: "항목코드", field: "item_code", width: 110 },
      { headerName: "항목명", field: "item_name", width: 130, editable: false },
      {
        headerName: "구분",
        field: "direction",
        width: 100,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["earning", "deduction"] },
      },
      { headerName: "금액", field: "amount", width: 120, valueParser: (p) => Number(p.newValue) || 0 },
      { headerName: "비고", field: "memo", flex: 1, minWidth: 180 },
    ],
    [toggleDelete],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">월 변동입력 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="월 변동입력 관리" onQuery={handleQueryRequest}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">귀속월(YYYY-MM)</div>
            <Input
              value={searchYearMonth}
              onChange={(event) => setSearchYearMonth(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleQueryRequest();
              }}
              placeholder="예: 2026-03"
              className="h-9 w-40 text-sm"
            />
          </div>
        </div>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={
          <>
            <GridPaginationControls
              page={page}
              totalPages={pagination.totalPages}
              pageInput={pagination.pageInput}
              setPageInput={pagination.setPageInput}
              goPrev={pagination.goPrev}
              goNext={pagination.goNext}
              goToPage={pagination.goToPage}
            />
            <span className="text-xs text-slate-400">총 {totalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} />
          </>
        }
        headerRight={
          <GridToolbarActions
            actions={[
              { key: "create", label: "입력", icon: Plus, onClick: addRow },
              { key: "copy", label: "복사", icon: Copy, onClick: copySelectedRows },
              { key: "template", label: "양식 다운로드", icon: Search, onClick: () => toast.success("양식 다운로드는 다음 단계에서 연결합니다.") },
              { key: "upload", label: "업로드", icon: Search, onClick: () => toast.success("업로드는 다음 단계에서 연결합니다.") },
              { key: "download", label: "다운로드", icon: Download, onClick: () => toast.success("다운로드는 다음 단계에서 연결합니다.") },
            ]}
            saveAction={{
              key: "save",
              label: saving ? "저장중..." : "저장",
              icon: Save,
              onClick: () => void saveAllChanges(),
              disabled: saving,
            }}
          />
        }
        contentClassName="min-h-0 flex-1 px-6 pb-4"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<RowData>
            theme="legacy"
            key={gridMountKey}
            rowData={pagedRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressRowClickSelection
            animateRows={false}
            rowClassRules={rowClassRules}
            getRowClass={(params) => getGridRowClass(params.data?._status)}
            getRowId={(params) => String(params.data.id)}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            localeText={{ page: "페이지", more: "더보기", noRowsToShow: "데이터가 없습니다." }}
            overlayNoRowsTemplate='<span class="text-sm text-slate-400">월 변동입력 데이터가 없습니다.</span>'
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
