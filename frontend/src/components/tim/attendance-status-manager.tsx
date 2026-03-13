"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimAttendanceDailyItem, TimAttendanceDailyListResponse } from "@/types/tim";

type AttendanceStatusGridRow = TimAttendanceDailyItem & ReadonlyGridRow;

const STATUS_LABELS: Record<string, string> = {
  present: "정상출근",
  late: "지각",
  absent: "결근",
  leave: "휴가",
  remote: "재택",
};

export function AttendanceStatusManager() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  const [filters, setFilters] = useState({
    startDate: monthStart,
    endDate: today,
    status: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      start_date: appliedFilters.startDate,
      end_date: appliedFilters.endDate,
      page: String(page),
      limit: String(pageSize),
    });
    if (appliedFilters.status) {
      params.set("status", appliedFilters.status);
    }
    return `/api/tim/attendance-daily?${params.toString()}`;
  }, [appliedFilters, page]);

  const { data, isLoading, mutate } = useSWR<TimAttendanceDailyListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });

  const rowData = useMemo<AttendanceStatusGridRow[]>(
    () => createReadonlyGridRows(data?.items ?? []),
    [data?.items],
  );

  const columnDefs = useMemo<ColDef<AttendanceStatusGridRow>[]>(
    () => [
      { field: "employee_no", headerName: "사번", width: 120 },
      { field: "employee_name", headerName: "이름", width: 120 },
      { field: "department_name", headerName: "부서", minWidth: 160, flex: 1 },
      { field: "work_date", headerName: "근무일", width: 120 },
      {
        field: "check_in_at",
        headerName: "출근",
        width: 120,
        valueFormatter: (params) =>
          params.value ? new Date(params.value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-",
      },
      {
        field: "check_out_at",
        headerName: "퇴근",
        width: 120,
        valueFormatter: (params) =>
          params.value ? new Date(params.value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-",
      },
      {
        field: "attendance_status",
        headerName: "상태",
        width: 120,
        valueFormatter: (params) => STATUS_LABELS[String(params.value ?? "")] ?? params.value,
      },
      {
        headerName: "정정",
        width: 110,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data?: AttendanceStatusGridRow }) => {
          if (!params.data) return null;
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/tim/correction?attendance_id=${params.data!.id}`)}
            >
              정정
            </Button>
          );
        },
      },
    ],
    [router],
  );

  return (
    <ReadonlyGridManager<AttendanceStatusGridRow>
      title="근태 현황"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-4">
          <Input
            type="date"
            value={filters.startDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
          />
          <Input
            type="date"
            value={filters.endDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
          />
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">전체 상태</option>
            <option value="present">정상출근</option>
            <option value="late">지각</option>
            <option value="absent">결근</option>
            <option value="leave">휴가</option>
            <option value="remote">재택</option>
          </select>
          <div className="flex items-center text-sm text-slate-500">
            기간별 출결 현황을 조회하고 정정 화면으로 이동할 수 있습니다.
          </div>
        </SearchFieldGrid>
      }
      rowData={rowData}
      columnDefs={columnDefs}
      totalCount={data?.total_count ?? 0}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedFilters(filters);
        void mutate();
      }}
      queryDisabled={isLoading}
      loading={isLoading}
      emptyText="조회된 근태 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
