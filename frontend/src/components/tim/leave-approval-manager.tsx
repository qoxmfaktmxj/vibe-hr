"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";
import { toast } from "sonner";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimLeaveRequestItem, TimLeaveRequestListResponse } from "@/types/tim";

type LeaveApprovalGridRow = TimLeaveRequestItem & ReadonlyGridRow;

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  sick: "병가",
  half_day: "반차",
  unpaid: "무급휴가",
  other: "기타",
};

export function LeaveApprovalManager() {
  const [statusInput, setStatusInput] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      pending_only: appliedStatus ? "false" : "true",
      page: String(page),
      limit: String(pageSize),
    });
    if (appliedStatus.trim()) {
      params.set("status", appliedStatus.trim());
    }
    return `/api/tim/leave-requests?${params.toString()}`;
  }, [appliedStatus, page]);

  const { data, isLoading, mutate } = useSWR<TimLeaveRequestListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });

  const rowData = useMemo<LeaveApprovalGridRow[]>(
    () => createReadonlyGridRows(data?.items ?? []),
    [data?.items],
  );

  const approve = useCallback(async (id: number) => {
    const response = await fetch(`/api/tim/leave-requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: null }),
    });

    if (!response.ok) {
      toast.error("휴가 승인 처리에 실패했습니다.");
      return;
    }

    toast.success("휴가 승인이 완료되었습니다.");
    await mutate();
  }, [mutate]);

  const reject = useCallback(async (id: number) => {
    const response = await fetch(`/api/tim/leave-requests/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason.trim() || "반려" }),
    });

    if (!response.ok) {
      toast.error("휴가 반려 처리에 실패했습니다.");
      return;
    }

    toast.success("휴가 반려가 완료되었습니다.");
    setRejectReason("");
    await mutate();
  }, [mutate, rejectReason]);

  const columnDefs: ColDef<LeaveApprovalGridRow>[] = [
      { field: "employee_no", headerName: "사번", width: 120 },
      { field: "employee_name", headerName: "이름", width: 120 },
      { field: "department_name", headerName: "부서", minWidth: 150, flex: 1 },
      {
        field: "leave_type",
        headerName: "휴가유형",
        width: 120,
        valueFormatter: (params) => LEAVE_TYPE_LABELS[String(params.value ?? "")] ?? params.value,
      },
      {
        headerName: "기간",
        minWidth: 180,
        valueGetter: (params) =>
          params.data ? `${params.data.start_date} ~ ${params.data.end_date}` : "",
      },
      { field: "leave_days", headerName: "차감일수", width: 110 },
      {
        field: "request_status",
        headerName: "상태",
        width: 100,
        valueFormatter: (params) => REQUEST_STATUS_LABELS[String(params.value ?? "")] ?? params.value,
      },
      { field: "reason", headerName: "사유", minWidth: 220, flex: 1.2 },
      {
        headerName: "처리",
        width: 160,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data?: LeaveApprovalGridRow }) => {
          if (!params.data) return null;
          return (
            <div className="flex gap-1">
              <Button size="sm" onClick={() => void approve(params.data!.id)}>
                승인
              </Button>
              <Button size="sm" variant="outline" onClick={() => void reject(params.data!.id)}>
                반려
              </Button>
            </div>
          );
        },
      },
    ];

  return (
    <ReadonlyGridManager<LeaveApprovalGridRow>
      title="휴가 승인"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-[1fr_1fr]">
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={statusInput}
            onChange={(event) => setStatusInput(event.target.value)}
          >
            <option value="">승인 대기만 보기</option>
            <option value="pending">대기</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            <option value="cancelled">취소</option>
          </select>
          <Input
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="반려 사유 기본값"
          />
        </SearchFieldGrid>
      }
      beforeGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">승인 처리 기준</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            각 행의 승인 또는 반려 버튼으로 휴가 요청을 즉시 처리할 수 있습니다.
          </CardContent>
        </Card>
      }
      rowData={rowData}
      columnDefs={columnDefs}
      totalCount={data?.total_count ?? 0}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedStatus(statusInput);
        void mutate();
      }}
      loading={isLoading}
      emptyText="휴가 승인 대상이 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
