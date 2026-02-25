"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/fetcher";
import type { TimAttendanceTodayResponse } from "@/types/tim";

function fmtDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

export function AttendanceCheckinManager() {
  const { data, isLoading } = useSWR<TimAttendanceTodayResponse>("/api/tim/attendance-daily/today", fetcher, {
    revalidateOnFocus: false,
  });

  const item = data?.item ?? null;
  const workedLabel = useMemo(() => {
    if (item?.worked_minutes == null) return "-";
    const hours = Math.floor(item.worked_minutes / 60);
    const minutes = item.worked_minutes % 60;
    return `${hours}시간 ${minutes}분`;
  }, [item?.worked_minutes]);

  async function doCheckIn() {
    const response = await fetch("/api/tim/attendance-daily/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { detail?: string } | null;
      return toast.error(json?.detail ?? "출근 처리 실패");
    }
    toast.success("출근 처리 완료");
    await mutate("/api/tim/attendance-daily/today");
  }

  async function doCheckOut() {
    const response = await fetch("/api/tim/attendance-daily/check-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { detail?: string } | null;
      return toast.error(json?.detail ?? "퇴근 처리 실패");
    }
    toast.success("퇴근 처리 완료");
    await mutate("/api/tim/attendance-daily/today");
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">오늘 출퇴근 현황</h2>
        {isLoading ? <p className="mt-3 text-sm text-muted-foreground">불러오는 중...</p> : null}

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded-md border bg-muted/30 p-3">출근시간: {fmtDateTime(item?.check_in_at ?? null)}</div>
          <div className="rounded-md border bg-muted/30 p-3">퇴근시간: {fmtDateTime(item?.check_out_at ?? null)}</div>
          <div className="rounded-md border bg-muted/30 p-3">근무시간: {workedLabel}</div>
          <div className="rounded-md border bg-muted/30 p-3">상태: {item?.attendance_status ?? "-"}</div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={doCheckIn}>출근</Button>
          <Button variant="outline" onClick={doCheckOut}>퇴근</Button>
        </div>
      </div>
    </div>
  );
}
