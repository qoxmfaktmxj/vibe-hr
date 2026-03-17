"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type CellValueChangedEvent, type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { buildGridRowClassRules, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { PapAppraisalItem, PapAppraisalListResponse } from "@/types/pap-appraisal";
import type {
  PapAppraisalTargetBatchRequest,
  PapAppraisalTargetItem,
  PapAppraisalTargetListResponse,
} from "@/types/pap-appraisal";

type TargetRow = PapAppraisalTargetItem & {
  _status: "clean" | "added" | "updated" | "deleted";
  _original?: Record<string, unknown>;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "미평가",
  evaluated: "평가완료",
  finalized: "확정",
};

export function PapAppraisalTargetsManager() {
  useMenuActions("/pap/targets");

  const gridRef = useRef<AgGridReact<TargetRow>>(null);
  const [gridApi, setGridApi] = useState<GridApi<TargetRow> | null>(null);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [selectedAppraisalId, setSelectedAppraisalId] = useState<number | null>(null);
  const pageSize = 200;

  // load appraisals for selection
  const { data: appraisalsData } = useSWR<PapAppraisalListResponse>(
    "/api/pap/appraisals?all=true&active_only=true",
    fetcher,
    { revalidateOnFocus: false },
  );

  const appraisals = useMemo(() => appraisalsData?.items ?? [], [appraisalsData?.items]);

  const queryUrl = useMemo(
    () => (selectedAppraisalId ? `/api/pap/targets?appraisal_id=${selectedAppraisalId}` : null),
    [selectedAppraisalId],
  );

  const { data, isLoading, mutate } = useSWR<PapAppraisalTargetListResponse>(queryUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const [rowData, setRowData] = useState<TargetRow[]>([]);
  useMemo(() => {
    const items = data?.items ?? [];
    setRowData(
      items.map((item) => ({
        ...item,
        _status: "clean" as const,
        _original: { ...(item as unknown as Record<string, unknown>) },
      })),
    );
  }, [data]);

  const totalCount = data?.total_count ?? 0;
  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });
  const rowClassRules = useMemo(() => buildGridRowClassRules<TargetRow>(), []);
  const gridSummary = useMemo(
    () => summarizeGridStatuses(rowData, (r) => r._status),
    [rowData],
  );

  const columnDefs = useMemo<ColDef<TargetRow>[]>(
    () => [
      {
        headerName: "사번",
        field: "employee_no",
        width: 120,
        editable: false,
        cellClass: (p) => getGridStatusCellClass(p.data?._status),
      },
      {
        headerName: "이름",
        field: "employee_name",
        width: 110,
        editable: false,
        cellClass: (p) => getGridStatusCellClass(p.data?._status),
      },
      {
        headerName: "부서",
        field: "department_name",
        width: 140,
        editable: false,
        cellClass: (p) => getGridStatusCellClass(p.data?._status),
      },
      {
        headerName: "점수",
        field: "score",
        width: 100,
        editable: true,
        cellClass: (p) => getGridStatusCellClass(p.data?._status),
      },
      {
        headerName: "등급",
        field: "grade_code",
        width: 90,
        editable: true,
        cellClass: (p) => getGridStatusCellClass(p.data?._status),
      },
      {
        headerName: "상태",
        field: "status",
        width: 100,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["pending", "evaluated", "finalized"] },
        valueFormatter: (p) => STATUS_LABELS[String(p.value ?? "")] ?? String(p.value ?? ""),
        cellClass: (p) => getGridStatusCellClass(p.data?._status),
      },
      {
        headerName: "평가 메모",
        field: "evaluator_note",
        flex: 1,
        minWidth: 200,
        editable: true,
        cellClass: (p) => getGridStatusCellClass(p.data?._status),
      },
    ],
    [],
  );

  const onGridReady = useCallback((e: GridReadyEvent<TargetRow>) => {
    setGridApi(e.api);
  }, []);

  const onCellValueChanged = useCallback((e: CellValueChangedEvent<TargetRow>) => {
    if (!e.data) return;
    setRowData((prev) =>
      prev.map((r) => {
        if (r.id !== e.data?.id) return r;
        const updated = { ...r, ...e.data };
        if (updated._status === "clean") updated._status = "updated";
        return updated;
      }),
    );
  }, []);

  const handleAddRow = useCallback(() => {
    if (!selectedAppraisalId) {
      toast.error("평가를 먼저 선택해주세요.");
      return;
    }
    const newRow: TargetRow = {
      id: -(Date.now()),
      appraisal_id: selectedAppraisalId,
      appraisal_name: null,
      employee_id: 0,
      employee_no: null,
      employee_name: null,
      department_name: null,
      score: null,
      grade_code: null,
      evaluator_note: null,
      status: "pending",
      evaluated_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _status: "added",
    };
    setRowData((prev) => [...prev, newRow]);
  }, [selectedAppraisalId]);

  const handleDeleteSelected = useCallback(() => {
    const selected = gridApi?.getSelectedRows() ?? [];
    if (selected.length === 0) return;
    const selectedIds = new Set(selected.map((s) => s.id));
    setRowData((prev) =>
      prev
        .filter((r) => !(selectedIds.has(r.id) && r._status === "added"))
        .map((r) => (selectedIds.has(r.id) && r._status !== "added" ? { ...r, _status: "deleted" as const } : r)),
    );
  }, [gridApi]);

  const handleSave = useCallback(async () => {
    const dirtyRows = rowData.filter((r) => r._status !== "clean");
    if (dirtyRows.length === 0) {
      toast.info("변경된 항목이 없습니다.");
      return;
    }

    setSaving(true);
    try {
      const payload: PapAppraisalTargetBatchRequest = {
        items: dirtyRows.map((r) => ({
          id: r.id < 0 ? undefined : r.id,
          appraisal_id: r.appraisal_id,
          employee_id: r.employee_id || undefined,
          score: r.score,
          grade_code: r.grade_code,
          evaluator_note: r.evaluator_note,
          status: r.status,
          _status: r._status,
        })),
      };
      const res = await fetch("/api/pap/targets/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "저장에 실패했습니다.");
        return;
      }
      const result = (await res.json()) as { created: number; updated: number; deleted: number };
      toast.success(`저장 완료 (신규 ${result.created}, 수정 ${result.updated}, 삭제 ${result.deleted})`);
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [rowData, mutate]);

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="평가 대상자 관리" onQuery={() => selectedAppraisalId && void mutate()}>
        <div className="flex items-center gap-3">
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={selectedAppraisalId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedAppraisalId(val ? Number(val) : null);
            }}
          >
            <option value="">평가 선택</option>
            {appraisals.map((a: PapAppraisalItem) => (
              <option key={a.id} value={a.id}>
                {a.appraisal_year}년 {a.appraisal_name}
              </option>
            ))}
          </select>
          {!selectedAppraisalId && (
            <p className="text-sm text-slate-500">평가를 선택하면 대상자 목록이 표시됩니다.</p>
          )}
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
            <GridChangeSummaryBadges summary={gridSummary} />
          </>
        }
        headerRight={
          <GridToolbarActions
            actions={[
              {
                key: "query",
                label: "조회",
                icon: Search,
                onClick: () => selectedAppraisalId && void mutate(),
                disabled: saving || !selectedAppraisalId,
              },
              {
                key: "add",
                label: "행추가",
                icon: Plus,
                onClick: handleAddRow,
                disabled: saving || !selectedAppraisalId,
              },
              {
                key: "delete",
                label: "삭제",
                icon: Trash2,
                onClick: handleDeleteSelected,
                disabled: saving,
              },
            ]}
            saveAction={{
              key: "save",
              label: "저장",
              icon: Save,
              onClick: () => void handleSave(),
              disabled: saving || (gridSummary.added + gridSummary.updated + gridSummary.deleted) === 0,
            }}
          />
        }
        contentClassName="min-h-0 flex-1 px-6 pb-6"
      >
        <div className="ag-theme-quartz vibe-grid h-full min-h-[400px] w-full overflow-hidden rounded-lg border border-gray-200">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">불러오는 중...</p>
            </div>
          ) : (
            <AgGridReact<TargetRow>
              ref={gridRef}
              theme="legacy"
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              rowSelection={{ mode: "multiRow", checkboxes: true }}
              rowClassRules={rowClassRules}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGridReady}
              onCellValueChanged={onCellValueChanged}
              localeText={{ noRowsToShow: "평가 대상자가 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">평가를 선택하거나 행을 추가하세요.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          )}
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}
