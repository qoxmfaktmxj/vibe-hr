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
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { snapshotFields, type GridRowStatus } from "@/lib/hr/grid-change-tracker";
import type {
  PayPayrollRunActionResponse,
  PayPayrollRunEmployeeDetailItem,
  PayPayrollRunEmployeeDetailResponse,
  PayPayrollRunEmployeeItem,
  PayPayrollRunItem,
} from "@/types/pay";

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
    _original: snapshotFields(item, [
      "status",
      "total_employees",
      "total_gross",
      "total_deductions",
      "total_net",
    ]),
  };
}

export function PayrollRunManager() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [rows, setRows] = useState<RowData[]>([]);
  const [employeeRows, setEmployeeRows] = useState<PayPayrollRunEmployeeItem[]>([]);
  const [detailRows, setDetailRows] = useState<PayPayrollRunEmployeeDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchYearMonth, setSearchYearMonth] = useState(currentMonth);
  const [searchStatus, setSearchStatus] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRunEmployeeId, setSelectedRunEmployeeId] = useState<number | null>(null);
  const [createYearMonth, setCreateYearMonth] = useState(currentMonth);
  const [createPayrollCodeId, setCreatePayrollCodeId] = useState("1");
  const [createRunName, setCreateRunName] = useState("");
  const [page, setPage] = useState(1);

  const gridApiRef = useRef<GridApi<RowData> | null>(null);
  const pageSize = 100;
  const rowClassRules = useMemo(() => buildGridRowClassRules<RowData>(), []);
  const singleRowSelection = useMemo(
    () => ({
      mode: "singleRow" as const,
      checkboxes: false,
      enableClickSelection: true,
    }),
    [],
  );
  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchYearMonth.trim()) params.set("year_month", searchYearMonth.trim());
      if (searchStatus.trim()) params.set("status", searchStatus.trim());
      const queryString = params.toString();
      const response = await fetch(`/api/pay/runs${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("급여 Run 목록을 불러오지 못했습니다.");
      }
      const json = (await response.json()) as { items: PayPayrollRunItem[] };
      setRows((json.items ?? []).map(toGridRow));
      setPage(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "목록 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [searchStatus, searchYearMonth]);

  const loadRunEmployees = useCallback(async (runId: number) => {
    try {
      const response = await fetch(`/api/pay/runs/${runId}/employees`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Run 대상자 결과를 불러오지 못했습니다.");
      }
      const json = (await response.json()) as EmployeeResponse;
      const nextItems = json.items ?? [];
      setEmployeeRows(nextItems);
      setSelectedRunEmployeeId((prev) => {
        if (prev && nextItems.some((item) => item.id === prev)) {
          return prev;
        }
        return nextItems[0]?.id ?? null;
      });
    } catch (error) {
      setEmployeeRows([]);
      setSelectedRunEmployeeId(null);
      toast.error(error instanceof Error ? error.message : "대상자 조회에 실패했습니다.");
    }
  }, []);

  const loadRunEmployeeDetail = useCallback(async (runId: number, runEmployeeId: number) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/pay/runs/${runId}/employees/${runEmployeeId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("대상자 항목 상세를 불러오지 못했습니다.");
      }
      const json = (await response.json()) as PayPayrollRunEmployeeDetailResponse;
      setDetailRows(json.items ?? []);
    } catch (error) {
      setDetailRows([]);
      toast.error(error instanceof Error ? error.message : "항목 상세 조회에 실패했습니다.");
    } finally {
      setDetailLoading(false);
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
    setSelectedRunEmployeeId(null);
    setDetailRows([]);
  }, [selectedRunId, loadRunEmployees]);

  useEffect(() => {
    if (selectedRunId && selectedRunEmployeeId) {
      void loadRunEmployeeDetail(selectedRunId, selectedRunEmployeeId);
      return;
    }
    setDetailRows([]);
  }, [selectedRunId, selectedRunEmployeeId, loadRunEmployeeDetail]);

  const totalCount = rows.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);
  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

  const onGridReady = useCallback((event: GridReadyEvent<RowData>) => {
    gridApiRef.current = event.api;
  }, []);
  void gridApiRef;

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
      {
        headerName: "상태",
        field: "_status",
        width: 68,
        editable: false,
        sortable: false,
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
      },
      { headerName: "ID", field: "id", width: 80 },
      { headerName: "급여월", field: "year_month", width: 100 },
      { headerName: "급여코드", field: "payroll_code_name", width: 130 },
      { headerName: "진행상태", field: "status", width: 110 },
      { headerName: "대상자", field: "total_employees", width: 100 },
      {
        headerName: "총지급",
        field: "total_gross",
        width: 130,
        valueFormatter: (params) => Number(params.value ?? 0).toLocaleString(),
      },
      {
        headerName: "총공제",
        field: "total_deductions",
        width: 130,
        valueFormatter: (params) => Number(params.value ?? 0).toLocaleString(),
      },
      {
        headerName: "실지급",
        field: "total_net",
        width: 130,
        valueFormatter: (params) => Number(params.value ?? 0).toLocaleString(),
      },
      { headerName: "Run명", field: "run_name", flex: 1, minWidth: 180 },
    ],
    [],
  );

  const employeeColDefs = useMemo<ColDef<PayPayrollRunEmployeeItem>[]>(
    () => [
      { headerName: "사번", field: "employee_no", width: 110 },
      { headerName: "이름", field: "employee_name", width: 120 },
      {
        headerName: "총지급",
        field: "gross_pay",
        width: 120,
        valueFormatter: (params) => Number(params.value ?? 0).toLocaleString(),
      },
      {
        headerName: "총공제",
        field: "total_deductions",
        width: 120,
        valueFormatter: (params) => Number(params.value ?? 0).toLocaleString(),
      },
      {
        headerName: "실지급",
        field: "net_pay",
        width: 120,
        valueFormatter: (params) => Number(params.value ?? 0).toLocaleString(),
      },
      { headerName: "상태", field: "status", width: 100 },
      { headerName: "경고", field: "warning_message", flex: 1, minWidth: 220 },
    ],
    [],
  );

  const detailColDefs = useMemo<ColDef<PayPayrollRunEmployeeDetailItem>[]>(
    () => [
      { headerName: "항목코드", field: "item_code", width: 110 },
      { headerName: "항목명", field: "item_name", minWidth: 140, flex: 1 },
      {
        headerName: "구분",
        field: "direction",
        width: 110,
        valueFormatter: (params) => (params.value === "earning" ? "지급" : "공제"),
      },
      {
        headerName: "금액",
        field: "amount",
        width: 130,
        valueFormatter: (params) => Number(params.value ?? 0).toLocaleString(),
      },
      { headerName: "과세구분", field: "tax_type", width: 120 },
      { headerName: "계산방식", field: "calculation_type", width: 120 },
      { headerName: "발생원천", field: "source_type", width: 110 },
    ],
    [],
  );

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRunId) ?? null,
    [rows, selectedRunId],
  );
  const selectedEmployeeRow = useMemo(
    () => employeeRows.find((row) => row.id === selectedRunEmployeeId) ?? null,
    [employeeRows, selectedRunEmployeeId],
  );
  const selectedRunStatus = selectedRow?.status ?? null;
  const canCalculate = selectedRunStatus === "draft" || selectedRunStatus === "calculated";
  const calculateActionLabel = selectedRunStatus === "calculated" ? "재계산" : "계산";
  const calculateActionPath = selectedRunStatus === "calculated" ? "recalculate" : "calculate";
  const canRefreshSnapshot = selectedRunStatus === "draft" || selectedRunStatus === "calculated";
  const canClose = selectedRunStatus === "calculated";
  const canMarkPaid = selectedRunStatus === "closed";
  const detailSummary = useMemo(() => {
    const earnings = detailRows
      .filter((row) => row.direction === "earning")
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const deductions = detailRows
      .filter((row) => row.direction === "deduction")
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const welfareCount = detailRows.filter((row) => row.source_type === "welfare").length;
    const insuranceCount = detailRows.filter((row) => row.tax_type === "insurance").length;
    return { earnings, deductions, welfareCount, insuranceCount };
  }, [detailRows]);

  async function createRun() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(createYearMonth.trim())) {
      toast.error("급여월 형식은 YYYY-MM 입니다.");
      return;
    }

    const payrollCodeId = Number(createPayrollCodeId || 0);
    if (payrollCodeId <= 0) {
      toast.error("payroll_code_id를 입력해 주세요.");
      return;
    }

    setWorking(true);
    try {
      const response = await fetch("/api/pay/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year_month: createYearMonth.trim(),
          payroll_code_id: payrollCodeId,
          run_name: createRunName.trim() || null,
        }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "Run 생성에 실패했습니다.");
        return;
      }

      const json = (await response.json()) as PayPayrollRunActionResponse;
      toast.success(`Run 생성 완료 (ID: ${json.run.id})`);
      setSelectedRunId(json.run.id);
      await loadRuns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Run 생성에 실패했습니다.");
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
      const response = await fetch(`/api/pay/runs/${selectedRunId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "작업에 실패했습니다.");
        return;
      }

      toast.success(successMessage);
      await loadRuns();
      await loadRunEmployees(selectedRunId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "작업에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">급여 Run 데이터를 불러오는 중입니다.</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="정기급여 Run 관리" onQuery={() => void loadRuns()}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">조회 급여월</div>
            <Input
              value={searchYearMonth}
              onChange={(event) => setSearchYearMonth(event.target.value)}
              placeholder="YYYY-MM"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">상태</div>
            <Input
              value={searchStatus}
              onChange={(event) => setSearchStatus(event.target.value)}
              placeholder="draft/calculated/closed/paid"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">신규 Run 생성</div>
            <div className="flex gap-2">
              <Input
                value={createYearMonth}
                onChange={(event) => setCreateYearMonth(event.target.value)}
                placeholder="YYYY-MM"
                className="h-9 text-sm"
              />
              <Input
                value={createPayrollCodeId}
                onChange={(event) => setCreatePayrollCodeId(event.target.value)}
                placeholder="code_id"
                className="h-9 w-28 text-sm"
              />
              <Input
                value={createRunName}
                onChange={(event) => setCreateRunName(event.target.value)}
                placeholder="선택 입력"
                className="h-9 text-sm"
              />
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
              {
                key: "copy",
                label: calculateActionLabel,
                icon: Calculator,
                onClick: () =>
                  void runAction(
                    calculateActionPath,
                    selectedRunStatus === "calculated" ? "재계산을 완료했습니다." : "급여 계산을 완료했습니다.",
                  ),
                disabled: working || !selectedRunId || !canCalculate,
              },
              {
                key: "template",
                label: "스냅샷 갱신",
                icon: RefreshCcw,
                onClick: () => void runAction("snapshot-backfill", "대상자 스냅샷을 갱신했습니다."),
                disabled: working || !selectedRunId || !canRefreshSnapshot,
              },
              {
                key: "upload",
                label: "마감",
                icon: Check,
                onClick: () => void runAction("close", "급여 마감을 완료했습니다."),
                disabled: working || !selectedRunId || !canClose,
              },
              {
                key: "download",
                label: "지급완료",
                icon: CheckCircle2,
                onClick: () => void runAction("mark-paid", "지급완료 처리했습니다."),
                disabled: working || !selectedRunId || !canMarkPaid,
              },
            ]}
            saveAction={{
              key: "save",
              label: "다운로드",
              icon: Download,
              onClick: () => toast.success("다운로드는 다음 단계에서 연결합니다."),
              disabled: working,
            }}
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
            rowSelection={singleRowSelection}
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
            {selectedRow
              ? `Run #${selectedRow.id} 대상자 결과`
              : "Run을 선택하면 대상자 계산 결과가 표시됩니다."}
          </div>
          <div className="ag-theme-quartz vibe-grid h-[260px] w-full overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<PayPayrollRunEmployeeItem>
              theme="legacy"
              rowData={employeeRows}
              columnDefs={employeeColDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              rowSelection={singleRowSelection}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onRowClicked={(event) => {
                if (!event.data) return;
                setSelectedRunEmployeeId(event.data.id);
              }}
              localeText={{ page: "페이지", noRowsToShow: "데이터가 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">대상자 계산 결과가 없습니다.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-700">
              {selectedEmployeeRow
                ? `${selectedEmployeeRow.employee_no ?? "-"} ${selectedEmployeeRow.employee_name ?? ""} 항목 상세`
                : "대상자를 선택하면 지급/공제 항목 상세가 표시됩니다."}
            </div>
            {selectedEmployeeRow ? (
              <div className="text-xs text-slate-500">
                과세소득 {selectedEmployeeRow.taxable_income.toLocaleString()} / 비과세 {selectedEmployeeRow.non_taxable_income.toLocaleString()}
              </div>
            ) : null}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">지급 합계</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{detailSummary.earnings.toLocaleString()}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">공제 합계</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{detailSummary.deductions.toLocaleString()}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">복리후생 반영건</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{detailSummary.welfareCount.toLocaleString()}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">사회보험 항목수</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{detailSummary.insuranceCount.toLocaleString()}</div>
            </div>
          </div>

          {selectedEmployeeRow?.warning_message ? (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              경고: {selectedEmployeeRow.warning_message}
            </div>
          ) : null}

          <div className="ag-theme-quartz vibe-grid h-[260px] w-full overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<PayPayrollRunEmployeeDetailItem>
              theme="legacy"
              rowData={detailRows}
              columnDefs={detailColDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              animateRows={false}
              loading={detailLoading}
              getRowId={(params) => String(params.data.id)}
              localeText={{ page: "페이지", noRowsToShow: "데이터가 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">항목 상세 데이터가 없습니다.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          </div>
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}
