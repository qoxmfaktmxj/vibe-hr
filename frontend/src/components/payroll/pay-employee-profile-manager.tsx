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
import type { PayEmployeeProfileBatchRequest, PayEmployeeProfileBatchResponse, PayEmployeeProfileItem } from "@/types/pay";

type RowStatus = GridRowStatus;

type RowData = PayEmployeeProfileItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

const TRACKED_FIELDS: (keyof PayEmployeeProfileItem)[] = [
  "employee_id",
  "payroll_code_id",
  "item_group_id",
  "base_salary",
  "pay_type_code",
  "payment_day_type",
  "payment_day_value",
  "holiday_adjustment",
  "effective_from",
  "effective_to",
  "is_active",
];

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
};

function snapshotOriginal(row: PayEmployeeProfileItem): Record<string, unknown> {
  return snapshotFields(row, TRACKED_FIELDS);
}

function isReverted(row: RowData): boolean {
  return isRowRevertedToOriginal(row, TRACKED_FIELDS);
}

function toGridRow(item: PayEmployeeProfileItem): RowData {
  return { ...item, _status: "clean", _original: snapshotOriginal(item) };
}

function createEmptyRow(tempId: number): RowData {
  const now = new Date().toISOString();
  return {
    id: tempId,
    employee_id: 0,
    employee_no: null,
    employee_name: null,
    payroll_code_id: 0,
    payroll_code_name: null,
    item_group_id: null,
    item_group_name: null,
    base_salary: 0,
    pay_type_code: "regular",
    payment_day_type: "fixed_day",
    payment_day_value: 25,
    holiday_adjustment: "previous_business_day",
    effective_from: now.slice(0, 10),
    effective_to: null,
    is_active: true,
    created_at: now,
    updated_at: now,
    _status: "added",
  };
}

export function PayEmployeeProfileManager() {
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [appliedSearchText, setAppliedSearchText] = useState("");
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pay/employee-profiles", { cache: "no-store" });
      if (!res.ok) throw new Error("직원 급여프로필 목록을 불러오지 못했습니다.");
      const data = (await res.json()) as { items: PayEmployeeProfileItem[] };
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
    void loadData();
  }, [loadData]);

  const commitRows = useCallback((updater: (prev: RowData[]) => RowData[]) => {
    const nextRows = updater(rowsRef.current);
    rowsRef.current = nextRows;
    setRows(nextRows);
  }, []);

  const addRow = useCallback(() => {
    commitRows((prev) => [createEmptyRow(issueTempId()), ...prev]);
  }, [commitRows]);

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
    setAppliedSearchText(searchText.trim());
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
        employee_id: Number(row.employee_id || 0),
        payroll_code_id: Number(row.payroll_code_id || 0),
        item_group_id: row.item_group_id ? Number(row.item_group_id) : null,
        base_salary: Number(row.base_salary || 0),
        pay_type_code: String(row.pay_type_code || "regular").trim(),
        payment_day_type: String(row.payment_day_type || "fixed_day").trim(),
        payment_day_value: row.payment_day_value ? Number(row.payment_day_value) : null,
        holiday_adjustment: String(row.holiday_adjustment || "previous_business_day").trim(),
        effective_from: String(row.effective_from || "").slice(0, 10),
        effective_to: row.effective_to ? String(row.effective_to).slice(0, 10) : null,
        is_active: Boolean(row.is_active),
      }));

    if (items.length === 0 && delete_ids.length === 0) {
      toast.error("저장할 변경사항이 없습니다.");
      return;
    }

    const invalid = items.find((item) => item.employee_id <= 0 || item.payroll_code_id <= 0 || !item.effective_from);
    if (invalid) {
      toast.error("employee_id / payroll_code_id / effective_from은 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const payload: PayEmployeeProfileBatchRequest = { items, delete_ids };
      const res = await fetch("/api/pay/employee-profiles/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "저장에 실패했습니다.");
        return;
      }

      const json = (await res.json()) as PayEmployeeProfileBatchResponse;
      const nextRows = json.items.map(toGridRow);
      rowsRef.current = nextRows;
      setRows(nextRows);
      gridApiRef.current = null;
      setGridMountKey((prev) => prev + 1);

      toast.success(
        `저장 완료 (입력 ${json.inserted_count}건 / 수정 ${json.updated_count}건 / 삭제 ${json.deleted_count}건)`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = useMemo(() => {
    const q = appliedSearchText.toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const text = `${row.employee_no ?? ""} ${row.employee_name ?? ""} ${row.employee_id}`.toLowerCase();
      return text.includes(q);
    });
  }, [rows, appliedSearchText]);

  const totalCount = filteredRows.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

  function handleTemplateDownload() {
    toast.success("양식 다운로드는 다음 단계에서 연결합니다.");
  }

  function handleUpload() {
    toast.success("업로드는 다음 단계에서 연결합니다.");
  }

  function handleDownload() {
    toast.success("다운로드는 다음 단계에서 연결합니다.");
  }

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
      { headerName: "사번", field: "employee_no", width: 110, editable: false },
      { headerName: "이름", field: "employee_name", width: 120, editable: false },
      { headerName: "employee_id", field: "employee_id", width: 110, valueParser: (p) => Number(p.newValue) || 0 },
      { headerName: "payroll_code_id", field: "payroll_code_id", width: 130, valueParser: (p) => Number(p.newValue) || 0 },
      {
        headerName: "item_group_id",
        field: "item_group_id",
        width: 120,
        valueParser: (p) => {
          const value = String(p.newValue ?? "").trim();
          return value ? Number(value) : null;
        },
      },
      { headerName: "기본급", field: "base_salary", width: 120, valueParser: (p) => Number(p.newValue) || 0 },
      { headerName: "지급유형", field: "pay_type_code", width: 110 },
      {
        headerName: "지급일유형",
        field: "payment_day_type",
        width: 120,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["fixed_day", "month_end"] },
      },
      { headerName: "지급일", field: "payment_day_value", width: 90, valueParser: (p) => (p.newValue ? Number(p.newValue) : null) },
      {
        headerName: "휴일보정",
        field: "holiday_adjustment",
        width: 160,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["previous_business_day", "next_business_day", "none"] },
      },
      { headerName: "적용시작", field: "effective_from", width: 120 },
      { headerName: "적용종료", field: "effective_to", width: 120 },
      {
        headerName: "활성",
        field: "is_active",
        width: 80,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: [true, false] },
      },
    ],
    [toggleDelete],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">직원 급여프로필 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="직원 급여프로필 관리" onQuery={handleQueryRequest}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">사번/이름/ID</div>
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleQueryRequest();
              }}
              placeholder="예: E001 / 홍길동 / 12"
              className="h-9 w-64 text-sm"
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
              { key: "template", label: "양식 다운로드", icon: Search, onClick: handleTemplateDownload },
              { key: "upload", label: "업로드", icon: Search, onClick: handleUpload },
              { key: "download", label: "다운로드", icon: Download, onClick: handleDownload },
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
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate='<span class="text-sm text-slate-400">직원 급여프로필 데이터가 없습니다.</span>'
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
