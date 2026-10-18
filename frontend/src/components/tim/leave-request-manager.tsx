"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { ReadonlyGridManager, createReadonlyGridRows } from "@/components/grid/readonly-grid-manager";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { getKoreaDateKey } from "@/lib/business-date";
import { fetcher } from "@/lib/fetcher";
import type { TimLeaveRequestListResponse } from "@/types/tim";

export function LeaveRequestManager() {
  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStartDate] = useState(getKoreaDateKey);
  const [endDate, setEndDate] = useState(getKoreaDateKey);
  const [reason, setReason] = useState("");
  const [cancelRequestId, setCancelRequestId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [page, setPage] = useState(1);
  const { data, isLoading, mutate: reload } = useSWR<TimLeaveRequestListResponse>(`/api/tim/leave-requests/my?page=${page}&limit=50`, fetcher, {
    revalidateOnFocus: false,
  });

  async function submit() {
    if (!reason.trim()) return toast.error("사유를 입력하세요.");

    const response = await fetch("/api/tim/leave-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { detail?: string } | null;
      return toast.error(json?.detail ?? "신청 실패");
    }

    toast.success("휴가 신청 완료");
    setReason("");
    await reload();
  }

  async function cancelRequest() {
    if (cancelling || !data?.items.some((item) => item.id === cancelRequestId && item.request_status === "pending")) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/tim/leave-requests/${cancelRequestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "사용자 취소" }),
      });

      if (!response.ok) return toast.error("취소 실패");
      toast.success("취소 완료");
      setCancelRequestId(null);
      await reload();
    } catch {
      toast.error("취소 실패");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="business-workspace space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">휴가 신청</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <select aria-label="휴가 유형" className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            <option value="annual">연차</option>
            <option value="sick">병가</option>
            <option value="half_day">반차</option>
            <option value="unpaid">무급</option>
            <option value="other">기타</option>
          </select>
          <Input aria-label="시작일" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input aria-label="종료일" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Input placeholder="사유" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="mt-3"><Button onClick={submit}>신청</Button></div>
      </div>

      <ReadonlyGridManager title="내 신청 목록" searchFields={null} embedded inset rowData={createReadonlyGridRows(data?.items ?? [])} totalCount={data?.total_count ?? 0} page={page} pageSize={50} onPageChange={setPage} loading={isLoading} queryDisabled={cancelling || isLoading} onQuery={() => void reload()} emptyText="신청한 휴가가 없습니다." columnDefs={[
        { field: "leave_type", headerName: "유형", width: 110, valueFormatter: p => ({ annual: "연차", sick: "병가", half_day: "반차", unpaid: "무급", other: "기타" })[p.value as string] ?? p.value },
        { field: "start_date", headerName: "시작일", width: 130 }, { field: "end_date", headerName: "종료일", width: 130 },
        { field: "leave_days", headerName: "일수", width: 90 },
        { field: "request_status", headerName: "상태", width: 110, valueFormatter: p => ({ pending: "대기", approved: "승인", rejected: "반려", cancelled: "취소" })[p.value as string] ?? p.value },
        { field: "reason", headerName: "사유", minWidth: 180, flex: 1 },
        { colId: "actions", headerName: "처리", width: 100, pinned: "right", sortable: false, filter: false, cellRenderer: ({ data: row }: { data?: import("@/types/tim").TimLeaveRequestItem }) => row?.request_status === "pending" ? <Button size="sm" variant="outline" className="!h-7 !min-h-7" disabled={cancelling} onClick={() => setCancelRequestId(row.id)}>취소</Button> : null },
      ]} />
      <ConfirmDialog
        open={cancelRequestId !== null}
        onOpenChange={(open) => { if (!open) setCancelRequestId(null); }}
        title="해당 신청을 취소할까요?"
        description="확인을 누르면 신청이 취소됩니다."
        busy={cancelling}
        onConfirm={() => void cancelRequest()}
      />
    </div>
  );
}
