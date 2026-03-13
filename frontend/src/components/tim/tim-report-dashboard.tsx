"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import useSWR from "swr";

import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import {
  buildGridRowClassRules,
  getGridRowClass,
  getGridStatusCellClass,
  type GridStatus,
} from "@/lib/grid/grid-status";
import { toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { fetcher } from "@/lib/fetcher";
import type {
  TimDepartmentSummaryItem,
  TimLeaveTypeSummaryItem,
  TimReportSummaryResponse,
} from "@/types/tim";

type ReportGridRowBase = {
  id: string;
  _status: GridStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: GridStatus;
};

type DepartmentReportRow = TimDepartmentSummaryItem & ReportGridRowBase;
type LeaveTypeReportRow = TimLeaveTypeSummaryItem & ReportGridRowBase;

function ReportMetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{description}</div>
    </div>
  );
}

export function TimReportDashboard() {
  const { data, isLoading, mutate } = useSWR<TimReportSummaryResponse>("/api/tim/reports/summary", fetcher, {
    revalidateOnFocus: false,
  });

  const departmentRowClassRules = useMemo(() => buildGridRowClassRules<DepartmentReportRow>(), []);
  const leaveRowClassRules = useMemo(() => buildGridRowClassRules<LeaveTypeReportRow>(), []);

  const departmentRows = useMemo<DepartmentReportRow[]>(
    () =>
      (data?.department_summaries ?? []).map((item) => ({
        ...item,
        id: `department-${item.department_id}`,
        _status: "clean",
        _original: item as unknown as Record<string, unknown>,
      })),
    [data?.department_summaries],
  );

  const leaveTypeRows = useMemo<LeaveTypeReportRow[]>(
    () =>
      (data?.leave_type_summaries ?? []).map((item) => ({
        ...item,
        id: `leave-${item.leave_type}`,
        _status: "clean",
        _original: item as unknown as Record<string, unknown>,
      })),
    [data?.leave_type_summaries],
  );

  const departmentColumns = useMemo<ColDef<DepartmentReportRow>[]>(
    () => [
      { field: "department_name", headerName: "부서", minWidth: 180, flex: 1 },
      { field: "attendance_count", headerName: "집계건수", width: 120 },
      { field: "present_rate", headerName: "출근율", width: 110 },
      { field: "late_rate", headerName: "지각율", width: 110 },
      { field: "absent_rate", headerName: "결근율", width: 110 },
    ],
    [],
  );

  const leaveTypeColumns = useMemo<ColDef<LeaveTypeReportRow>[]>(
    () => [
      { field: "leave_type", headerName: "휴가유형", minWidth: 160, flex: 1 },
      { field: "request_count", headerName: "요청건수", width: 120 },
      { field: "approved_count", headerName: "승인건수", width: 120 },
      { field: "pending_count", headerName: "대기건수", width: 120 },
    ],
    [],
  );

  const departmentDefaultColDef = useMemo<ColDef<DepartmentReportRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
      cellClass: (params) => getGridStatusCellClass(params.data?._status),
    }),
    [],
  );
  const leaveDefaultColDef = useMemo<ColDef<LeaveTypeReportRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
      cellClass: (params) => getGridStatusCellClass(params.data?._status),
    }),
    [],
  );

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="근태 리포트" onQuery={() => void mutate()} queryDisabled={isLoading}>
        <SearchFieldGrid className="md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            집계 기간: {data?.start_date ?? "-"} ~ {data?.end_date ?? "-"}
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            출결 데이터: {(data?.total_attendance_records ?? 0).toLocaleString()}건
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            휴가 요청: {(data?.total_leave_requests ?? 0).toLocaleString()}건
          </div>
        </SearchFieldGrid>
      </ManagerSearchSection>

      <div className="grid gap-4 md:grid-cols-5">
        <ReportMetricCard title="정상출근" value={String(data?.status_counts.present ?? 0)} description="정상 출근 건수" />
        <ReportMetricCard title="지각" value={String(data?.status_counts.late ?? 0)} description="지각 건수" />
        <ReportMetricCard title="결근" value={String(data?.status_counts.absent ?? 0)} description="결근 건수" />
        <ReportMetricCard title="휴가" value={String(data?.status_counts.leave ?? 0)} description="휴가 사용 건수" />
        <ReportMetricCard title="재택" value={String(data?.status_counts.remote ?? 0)} description="재택 근무 건수" />
      </div>

      <ManagerGridSection
        headerLeft={<span className="text-sm text-slate-500">부서별 집계 {departmentRows.length.toLocaleString()}건</span>}
        headerRight={<GridToolbarActions actions={[{ key: "query", label: "조회", onClick: () => void mutate() }]} />}
      >
        <div className="ag-theme-quartz vibe-grid h-[320px] w-full overflow-hidden rounded-b-xl border-t border-slate-200">
          <AgGridReact<DepartmentReportRow>
            theme="legacy"
            rowData={departmentRows}
            columnDefs={departmentColumns}
            defaultColDef={departmentDefaultColDef}
            rowClassRules={departmentRowClassRules}
            getRowClass={(params) => getGridRowClass(params.data?._status)}
            rowHeight={36}
            headerHeight={36}
            overlayNoRowsTemplate="<span class='text-sm text-slate-400'>데이터가 없습니다.</span>"
          />
        </div>
      </ManagerGridSection>

      <ManagerGridSection
        headerLeft={<span className="text-sm text-slate-500">휴가유형별 집계 {leaveTypeRows.length.toLocaleString()}건</span>}
        headerRight={<GridToolbarActions actions={[{ key: "query", label: "조회", onClick: () => void mutate() }]} />}
      >
        <div className="ag-theme-quartz vibe-grid h-[260px] w-full overflow-hidden rounded-b-xl border-t border-slate-200">
          <AgGridReact<LeaveTypeReportRow>
            theme="legacy"
            rowData={leaveTypeRows}
            columnDefs={leaveTypeColumns}
            defaultColDef={leaveDefaultColDef}
            rowClassRules={leaveRowClassRules}
            getRowClass={(params) => getGridRowClass(params.data?._status)}
            rowHeight={36}
            headerHeight={36}
            overlayNoRowsTemplate="<span class='text-sm text-slate-400'>데이터가 없습니다.</span>"
          />
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
void toggleDeletedStatus;
