"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Check, CheckCircle2, Download, Plus, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { Input } from "@/components/ui/input";
import { snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import type { PayPayrollRunActionResponse, PayPayrollRunEmployeeItem, PayPayrollRunItem } from "@/types/pay";

type EmployeeResponse = {
  items: PayPayrollRunEmployeeItem[];
  total_count: number;
};

type RowStatus = GridRowStatus;

type RowData = PayPayrollRunItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

function toGridRow(item: PayPayrollRunItem): RowData {
  return {
    ...item,
    _status: "clean",
    _original: snapshotFields(item, ["status", "total_employees", "total_gross", "total_deductions", "total_net"]),
  };
}

export function PayrollRunManager() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [rows, setRows] = useState<RowData[]>([]);
  const [employeeRows, setEmployeeRows] = useState<PayPayrollRunEmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [searchYearMonth, setSearchYearMonth] = useState(currentMonth);
  const [searchStatus, setSearchStatus] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [createYearMonth, setCreateYearMonth] = useState(currentMonth);
  const [createPayrollCodeId, setCreatePayrollCodeId] = useState("1");
  const [createRunName, setCreateRunName] = useState("");
  const [page, setPage] = useState(1);

  const gridApiRef = useRef<GridApi<RowData> | null>(null);
  const pageSize = 100;
  const rowClassRules = useMemo(() => buildGridRowClassRules<RowData>(), []);
  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchYearMonth.trim()) params.set("year_month", searchYearMonth.trim());
      if (searchStatus.trim()) params.set("status", searchStatus.trim());
      const qs = params.toString();
      const res = await fetch(`/api/pay/runs${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error("급여 Run 목록을 불러오지 못했습니다.");
      const json = (await res.json()) as { items: PayPayrollRunItem[] };
      setRows((json.items ?? []).map(toGridRow));
      setPage(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [searchStatus, searchYearMonth]);

  const loadRunEmployees = useCallback(async (runId: number) => {
    try {
      const res = await fetch(`/api/pay/runs/${runId}/employees`, { cache: "no-store" });
      if (!res.ok) throw new Error("Run 사원 결과를 불러오지 못했습니다.");
      const json = (await res.json()) as EmployeeResponse;
      setEmployeeRows(json.items ?? []);
    } catch (error) {
      setEmployeeRows([]);
      toast.error(error instanceof Error ? error.message : "상세 로딩 실패");
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (selectedRunId) {
      void loadRunEmployees(selectedRunId);
      return;
    }
    setEmployeeRows([]);
  }, [selectedRunId, loadRunEmployees]);

  const totalCount = rows.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);
  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

  const onGridReady = useCallback((event: GridReadyEvent<RowData>) => {
    gridApiRef.current = event.api;
  }, []);

  const toggleDelete = useCallback((rowId: number, checked: boolean) => {
    setRows((prev) =>
      toggleDeletedStatus(prev, rowId, checked, {
        shouldBeClean: () => true,
        removeAddedRow: false,
      }),
    );
  }, []);
  void toggleDelete;

  const columnDefs = useMemo<ColDef<RowData>[]>(
    () => [
      { headerName: "상태", field: "_status", width: 68, editable: false, sortable: false, cellClass: (p) => getGridStatusCellClass(p.value as RowStatus), valueFormatter: (p) => STATUS_LABELS[(p.value as RowStatus) ?? "clean"] },
      { headerName: "ID", field: "id", width: 80 },
      { headerName: "귀속월", field: "year_month", width: 100 },
      { headerName: "급여코드", field: "payroll_code_name", width: 130 },
      { headerName: "상태", field: "status", width: 110 },
      { headerName: "대상자", field: "total_employees", width: 100 },
      { headerName: "총지급", field: "total_gross", width: 130, valueFormatter: (p) => Number(p.value ?? 0).toLocaleString() },
      { headerName: "총공제", field: "total_deductions", width: 130, valueFormatter: (p) => Number(p.value ?? 0).toLocaleString() },
      { headerName: "실지급", field: "total_net", width: 130, valueFormatter: (p) => Number(p.value ?? 0).toLocaleString() },
      { headerName: "Run명", field: "run_name", flex: 1, minWidth: 160 },
    ],
    [],
  );

  const employeeColDefs = useMemo<ColDef<PayPayrollRunEmployeeItem>[]>(
    () => [
      { headerName: "사번", field: "employee_no", width: 110 },
      { headerName: "이름", field: "employee_name", width: 120 },
      { headerName: "총지급", field: "gross_pay", width: 120, valueFormatter: (p) => Number(p.value ?? 0).toLocaleString() },
      { headerName: "총공제", field: "total_deductions", width: 120, valueFormatter: (p) => Number(p.value ?? 0).toLocaleString() },
      { headerName: "실지급", field: "net_pay", width: 120, valueFormatter: (p) => Number(p.value ?? 0).toLocaleString() },
      { headerName: "상태", field: "status", width: 100 },
      { headerName: "경고", field: "warning_message", flex: 1, minWidth: 200 },
    ],
    [],
  );

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedRunId) ?? null, [rows, selectedRunId]);

  async function createRun() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(createYearMonth.trim())) {
      toast.error("귀속월 형식은 YYYY-MM 입니다.");
      return;
    }

    const payrollCodeId = Number(createPayrollCodeId || 0);
    if (payrollCodeId <= 0) {
      toast.error("payroll_code_id를 입력해 주세요.");
      return;
    }

    setWorking(true);
    try {
      const res = await fetch("/api/pay/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year_month: createYearMonth.trim(),
          payroll_code_id: payrollCodeId,
          run_name: createRunName.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "Run 생성 실패");
        return;
      }

      const json = (await res.json()) as PayPayrollRunActionResponse;
      toast.success(`Run 생성 완료 (ID: ${json.run.id})`);
      setSelectedRunId(json.run.id);
      await loadRuns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Run 생성 실패");
    } finally {
      setWorking(false);
    }
  }

  async function runAction(path: string, successMessage: string) {
    if (!selectedRunId) {
      toast.error("대상 Run을 먼저 선택해 주세요.");
      return;
    }

    setWorking(true);
    try {
      const res = await fetch(`/api/pay/runs/${selectedRunId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "작업 실패");
        return;
      }

      toast.success(successMessage);
      await loadRuns();
      await loadRunEmployees(selectedRunId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "작업 실패");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">급여 Run 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="월 급여 Run 관리" onQuery={() => void loadRuns()}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">조회 귀속월</div>
            <Input value={searchYearMonth} onChange={(e) => setSearchYearMonth(e.target.value)} placeholder="YYYY-MM" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">상태</div>
            <Input value={searchStatus} onChange={(e) => setSearchStatus(e.target.value)} placeholder="draft/calculated/closed/paid" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">신규 Run (귀속월 / payroll_code_id / run명)</div>
            <div className="flex gap-2">
              <Input value={createYearMonth} onChange={(e) => setCreateYearMonth(e.target.value)} placeholder="YYYY-MM" className="h-9 text-sm" />
              <Input value={createPayrollCodeId} onChange={(e) => setCreatePayrollCodeId(e.target.value)} placeholder="code_id" className="h-9 w-28 text-sm" />
              <Input value={createRunName} onChange={(e) => setCreateRunName(e.target.value)} placeholder="옵션" className="h-9 text-sm" />
            </div>
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
              { key: "query", label: "조회", icon: Search, onClick: () => void loadRuns(), disabled: working },
              { key: "create", label: "Run 생성", icon: Plus, onClick: () => void createRun(), disabled: working },
              { key: "copy", label: "계산", icon: Calculator, onClick: () => void runAction("calculate", "계산 완료"), disabled: working || !selectedRunId },
              { key: "template", label: "재계산", icon: RefreshCcw, onClick: () => void runAction("recalculate", "재계산 완료"), disabled: working || !selectedRunId },
              { key: "upload", label: "마감", icon: Check, onClick: () => void runAction("close", "마감 완료"), disabled: working || !selectedRunId },
              { key: "download", label: "지급완료", icon: CheckCircle2, onClick: () => void runAction("mark-paid", "지급완료 처리"), disabled: working || !selectedRunId },
            ]}
            saveAction={{ key: "save", label: "다운로드", icon: Download, onClick: () => toast.success("다운로드는 다음 단계에서 연결합니다."), disabled: working }}
          />
        }
        contentClassName="min-h-0 flex-1 px-6 pb-4"
      >
        <div className="ag-theme-quartz vibe-grid mb-3 h-[320px] w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<RowData>
            theme="legacy"
            rowData={pagedRows}
            columnDefs={columnDefs}
            defaultColDef={{ sortable: true, resizable: true, filter: false }}
            rowSelection="single"
            suppressRowClickSelection={false}
            animateRows={false}
            rowClassRules={rowClassRules}
            getRowClass={(params) => getGridRowClass(params.data?._status)}
            getRowId={(params) => String(params.data.id)}
            onGridReady={onGridReady}
            onRowClicked={(event) => {
              if (!event.data) return;
              setSelectedRunId(event.data.id);
            }}
            localeText={{ page: "페이지", noRowsToShow: "데이터가 없습니다." }}
            overlayNoRowsTemplate='<span class="text-sm text-slate-400">급여 Run 데이터가 없습니다.</span>'
            headerHeight={36}
            rowHeight={34}
          />
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 text-sm font-medium text-slate-700">
            {selectedRow ? `Run #${selectedRow.id} 대상자 결과` : "Run을 선택하면 대상자 결과가 표시됩니다."}
          </div>
          <div className="ag-theme-quartz vibe-grid h-[260px] w-full overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<PayPayrollRunEmployeeItem>
              theme="legacy"
              rowData={employeeRows}
              columnDefs={employeeColDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              localeText={{ page: "페이지", noRowsToShow: "데이터가 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">대상자 결과 데이터가 없습니다.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          </div>
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}
