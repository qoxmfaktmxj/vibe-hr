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
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { SEARCH_PLACEHOLDERS } from "@/lib/grid/search-presets";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { fetcher } from "@/lib/fetcher";
import { isRowRevertedToOriginal } from "@/lib/hr/grid-change-tracker";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { EmployeeItem, EmployeeListResponse } from "@/types/employee";
import type { PapAppraisalItem, PapAppraisalListResponse } from "@/types/pap-appraisal";
import type {
  PapAppraisalTargetBatchRequest,
  PapAppraisalTargetItem,
  PapAppraisalTargetListResponse,
} from "@/types/pap-appraisal";

type TargetRow = PapAppraisalTargetItem & {
  _status: "clean" | "added" | "updated" | "deleted";
  _original?: Record<string, unknown>;
  _prevStatus?: "clean" | "added" | "updated" | "deleted";
};

const TRACKED_FIELDS = ["score", "grade_code", "status", "evaluator_note"] as const;

function reconcileRow(row: TargetRow): TargetRow {
  return reconcileUpdatedStatus({
    ...row,
    score: row.score == null || String(row.score).trim() === "" ? null : Number(row.score),
  }, {
    shouldBeClean: (candidate) => isRowRevertedToOriginal(candidate, TRACKED_FIELDS),
  });
}

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
  const [rowData, setRowData] = useState<TargetRow[]>([]);
  const rowsRef = useRef<TargetRow[]>([]);
  const tempIdRef = useRef(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingAppraisal, setPendingAppraisal] = useState<{ id: number | null } | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
  const [employeeResults, setEmployeeResults] = useState<EmployeeItem[]>([]);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeeSearching, setEmployeeSearching] = useState(false);
  const replaceRows = useCallback((rows: TargetRow[]) => {
    rowsRef.current = rows;
    setRowData(rows);
  }, []);

  // load appraisals for selection
  const { data: appraisalsData } = useSWR<PapAppraisalListResponse>(
    "/api/pap/appraisals?all=true&active_only=true",
    fetcher,
    { revalidateOnFocus: false },
  );

  const appraisals = useMemo(() => appraisalsData?.items ?? [], [appraisalsData?.items]);

  const loadTargets = useCallback(async (appraisalId: number | null) => {
    setSelectedAppraisalId(appraisalId);
    setPage(1);
    replaceRows([]);
    setTotalCount(0);
    if (!appraisalId) return;
    setIsLoading(true);
    try {
      const data = await fetcher<PapAppraisalTargetListResponse>(`/api/pap/targets?appraisal_id=${appraisalId}`);
      replaceRows(data.items.map((item) => ({
        ...item,
        _status: "clean" as const,
        _original: { ...(item as unknown as Record<string, unknown>) },
      })));
      setTotalCount(data.total_count);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "평가 대상자를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [replaceRows]);

  const requestReload = useCallback((appraisalId: number | null) => {
    gridApi?.stopEditing();
    const currentRows = rowsRef.current.map(reconcileRow);
    if (currentRows.some((row) => row._status !== "clean")) {
      replaceRows(currentRows);
      setPendingAppraisal({ id: appraisalId });
      return;
    }
    void loadTargets(appraisalId);
  }, [gridApi, loadTargets, replaceRows]);

  const pagination = useGridPagination({ page, totalCount, pageSize: Math.max(1, totalCount), onPageChange: setPage });
  const rowClassRules = useMemo(() => buildGridRowClassRules<TargetRow>(), []);
  const getRowClass = useCallback((params: { data?: TargetRow }) => getGridRowClass(params.data?._status), []);
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
        cellDataType: false,
        cellEditor: "agTextCellEditor",
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
    const changed = e.data;
    if (!changed) return;
    replaceRows(
      rowsRef.current.map((r) => {
        if (r.id !== changed.id) return r;
        return reconcileRow({ ...r, ...changed });
      }),
    );
  }, [replaceRows]);

  const handleEmployeeSearch = useCallback(async () => {
    if (!employeeName.trim() && !employeeNo.trim()) {
      toast.error("이름 또는 사번을 입력해주세요.");
      return;
    }
    setEmployeeSearching(true);
    setEmployeeResults([]);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (employeeName.trim()) params.set("name", employeeName.trim());
      if (employeeNo.trim()) params.set("employee_no", employeeNo.trim());
      const data = await fetcher<EmployeeListResponse>(`/api/employees?${params}`);
      setEmployeeResults(data.employees);
      setEmployeeTotal(data.total_count);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "사원을 검색하지 못했습니다.");
    } finally {
      setEmployeeSearching(false);
    }
  }, [employeeName, employeeNo]);

  const handleAddEmployee = useCallback((employee: EmployeeItem) => {
    if (!selectedAppraisalId) return;
    if (rowsRef.current.some((row) => row.employee_id === employee.id)) {
      toast.error("이미 등록된 평가 대상자입니다.");
      return;
    }
    const newRow: TargetRow = {
      id: tempIdRef.current--,
      appraisal_id: selectedAppraisalId,
      appraisal_name: null,
      employee_id: employee.id,
      employee_no: employee.employee_no,
      employee_name: employee.display_name,
      department_name: employee.department_name,
      score: null,
      grade_code: null,
      evaluator_note: null,
      status: "pending",
      evaluated_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _status: "added",
    };
    replaceRows([...rowsRef.current, newRow]);
    setEmployeeDialogOpen(false);
  }, [selectedAppraisalId, replaceRows]);

  const handleDeleteSelected = useCallback(() => {
    const selected = gridApi?.getSelectedRows() ?? [];
    if (selected.length === 0) return;
    replaceRows(
      selected.reduce((rows, selectedRow) => toggleDeletedStatus(rows, selectedRow.id, selectedRow._status !== "deleted", {
        removeAddedRow: true,
        shouldBeClean: (row) => isRowRevertedToOriginal(row, TRACKED_FIELDS),
      }), rowsRef.current),
    );
  }, [gridApi, replaceRows]);

  const handleSave = useCallback(async () => {
    gridApi?.stopEditing();
    const currentRows = rowsRef.current.map(reconcileRow);
    replaceRows(currentRows);
    const dirtyRows = currentRows.filter((r) => r._status !== "clean");
    if (dirtyRows.length === 0) {
      toast.info("변경된 항목이 없습니다.");
      return;
    }
    if (dirtyRows.some((row) => row._status === "added" && (!Number.isInteger(row.employee_id) || row.employee_id <= 0))) {
      toast.error("신규 평가 대상자의 사원을 선택해주세요.");
      return;
    }
    if (dirtyRows.some((row) => row._status !== "deleted" && row.score !== null && !Number.isFinite(row.score))) {
      toast.error("점수는 올바른 숫자로 입력해주세요.");
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
          clear_score: r._status === "updated" && r.score === null && r._original?.score != null ? true : undefined,
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
      await loadTargets(selectedAppraisalId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [gridApi, loadTargets, replaceRows, selectedAppraisalId]);

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="평가 대상자 관리" onQuery={() => requestReload(selectedAppraisalId)} queryDisabled={saving || isLoading || !selectedAppraisalId}>
        <div className="flex items-center gap-3">
          <select
            aria-label="평가 선택"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={selectedAppraisalId ?? ""}
            disabled={saving || isLoading}
            onChange={(e) => {
              const val = e.target.value;
              requestReload(val ? Number(val) : null);
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
            <p className="text-sm text-muted-foreground">평가를 선택하면 대상자 목록이 표시됩니다.</p>
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
            <span className="text-xs text-muted-foreground">총 {totalCount.toLocaleString()}건</span>
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
                onClick: () => requestReload(selectedAppraisalId),
                disabled: saving || isLoading || !selectedAppraisalId,
              },
              {
                key: "add",
                label: "행추가",
                icon: Plus,
                onClick: () => {
                  setEmployeeResults([]);
                  setEmployeeTotal(0);
                  setEmployeeDialogOpen(true);
                },
                disabled: saving || isLoading || !selectedAppraisalId,
              },
              {
                key: "delete",
                label: "삭제",
                icon: Trash2,
                onClick: handleDeleteSelected,
                disabled: saving || isLoading,
              },
            ]}
            saveAction={{
              key: "save",
              label: "저장",
              icon: Save,
              onClick: () => void handleSave(),
              disabled: saving || isLoading || (gridSummary.added + gridSummary.updated + gridSummary.deleted) === 0,
            }}
          />
        }
        contentClassName="min-h-0 flex-1 px-6 pb-6"
      >
        <div className="ag-theme-quartz vibe-grid h-full min-h-[400px] w-full overflow-hidden rounded-lg border border-border">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
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
              getRowClass={getRowClass}
              readOnlyEdit={saving}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGridReady}
              onCellValueChanged={onCellValueChanged}
              localeText={{ noRowsToShow: "평가 대상자가 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-muted-foreground">평가를 선택하거나 행을 추가하세요.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          )}
        </div>
      </ManagerGridSection>

      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto pb-6">
          <DialogHeader>
            <DialogTitle>평가 대상자 선택</DialogTitle>
            <DialogDescription>이름 또는 사번으로 검색한 후 사원을 선택해주세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pt-4">
            <form onSubmit={(event) => { event.preventDefault(); void handleEmployeeSearch(); }} className="flex flex-col gap-2 sm:flex-row">
              <SearchFieldGrid>
                <SearchTextField value={employeeName} onChange={setEmployeeName} placeholder={SEARCH_PLACEHOLDERS.employeeName} />
                <SearchTextField value={employeeNo} onChange={setEmployeeNo} placeholder={SEARCH_PLACEHOLDERS.employeeNo} />
              </SearchFieldGrid>
              <Button type="submit" variant="query" disabled={employeeSearching}>사원 검색</Button>
            </form>
            <p className="text-xs text-muted-foreground">
              검색 결과 {employeeTotal.toLocaleString()}건{employeeTotal > 50 ? " (최대 50건 표시, 검색 조건을 좁혀주세요.)" : ""}
            </p>
            <div className="flex flex-col gap-2">
              {employeeResults.map((employee) => (
                <Button key={employee.id} variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" onClick={() => handleAddEmployee(employee)}>
                  {employee.display_name} ({employee.employee_no}) / {employee.department_name}
                </Button>
              ))}
              {employeeSearching && <p className="text-sm text-muted-foreground">검색 중...</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingAppraisal !== null}
        onOpenChange={(open) => { if (!open) setPendingAppraisal(null); }}
        title="저장되지 않은 변경 사항이 있습니다."
        description="현재 변경 내용을 저장하지 않고 이동하면 수정 내용이 사라집니다. 계속 진행하시겠습니까?"
        confirmLabel="무시하고 이동"
        cancelLabel="취소"
        onConfirm={() => {
          if (pendingAppraisal) void loadTargets(pendingAppraisal.id);
          setPendingAppraisal(null);
        }}
      />
    </ManagerPageShell>
  );
}
