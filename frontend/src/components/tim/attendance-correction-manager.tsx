"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimAttendanceCorrectionListResponse, TimAttendanceDailyItem } from "@/types/tim";

export function AttendanceCorrectionManager() {
  const searchParams = useSearchParams();
  const attendanceId = Number(searchParams.get("attendance_id") ?? "0");

  const [newStatus, setNewStatus] = useState("present");
  const [reason, setReason] = useState("");

  const { data: current } = useSWR<TimAttendanceDailyItem>(
    attendanceId ? `/api/tim/attendance-daily/${attendanceId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: corrections } = useSWR<TimAttendanceCorrectionListResponse>(
    attendanceId ? `/api/tim/attendance-daily/${attendanceId}/corrections` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  async function submit() {
    if (!attendanceId) return toast.error("attendance_id가 없습니다.");
    if (!reason.trim()) return toast.error("수정 사유를 입력하세요.");

    const response = await fetch(`/api/tim/attendance-daily/${attendanceId}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_status: newStatus, reason }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { detail?: string } | null;
      return toast.error(json?.detail ?? "수정 실패");
    }

    toast.success("근태 수정 완료");
    setReason("");
    await mutate(`/api/tim/attendance-daily/${attendanceId}/corrections`);
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">근태 정정</h2>
        <p className="mt-1 text-sm text-muted-foreground">대상 ID: {attendanceId || "-"}</p>
        {current ? <p className="mt-1 text-sm text-muted-foreground">현재 상태: {current.attendance_status}</p> : null}

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <select className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <option value="present">present</option>
            <option value="late">late</option>
            <option value="absent">absent</option>
            <option value="leave">leave</option>
            <option value="remote">remote</option>
          </select>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="수정 사유" />
        </div>

        <div className="mt-3">
          <Button onClick={submit}>저장</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">수정 이력</h3>
        <div className="space-y-2 text-sm">
          {(corrections?.corrections ?? []).map((item) => (
            <div key={item.id} className="rounded-md border bg-muted/30 p-3">
              <p>{item.old_status} → {item.new_status}</p>
              <p className="text-muted-foreground">사유: {item.reason}</p>
              <p className="text-muted-foreground">일시: {new Date(item.corrected_at).toLocaleString("ko-KR")}</p>
            </div>
          ))}
          {(corrections?.corrections ?? []).length === 0 ? <p className="text-muted-foreground">수정 이력 없음</p> : null}
        </div>
      </div>
    </div>
  );
}
