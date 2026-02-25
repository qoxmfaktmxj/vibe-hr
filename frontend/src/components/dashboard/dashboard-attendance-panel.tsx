"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/fetcher";
import type { TimTodayScheduleResponse } from "@/types/tim";

function getKoreaDateTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")} (${pick("weekday")}) ${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

function fmtDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}

type DashboardAttendancePanelProps = {
  compact?: boolean;
};

export function DashboardAttendancePanel({ compact = false }: DashboardAttendancePanelProps) {
  const [clock, setClock] = useState(getKoreaDateTime());
  const { data, isLoading } = useSWR<TimTodayScheduleResponse>("/api/tim/attendance-daily/today-schedule", fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(getKoreaDateTime());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const workedLabel = useMemo(() => {
    const minutes = data?.attendance?.worked_minutes;
    if (minutes == null) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}시간 ${m}분`;
  }, [data?.attendance?.worked_minutes]);

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
    await mutate("/api/tim/attendance-daily/today-schedule");
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
    await mutate("/api/tim/attendance-daily/today-schedule");
  }

  const dayTypeLabel =
    data?.schedule.day_type === "holiday"
      ? `공휴일${data.schedule.holiday_name ? ` (${data.schedule.holiday_name})` : ""}`
      : data?.schedule.day_type === "weekend"
        ? "주말"
        : "근무일";

  return (
    <div className={`rounded-xl border bg-card p-4 ${compact ? "h-full" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">대한민국 표준시 (KST)</p>
          <p className="font-mono text-lg font-semibold tracking-wide">{clock}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>오늘 구분: {dayTypeLabel ?? "-"}</p>
          <p>
            오늘 스케줄: {data?.schedule.schedule_name ?? "-"} ({data?.schedule.work_start ?? "--:--"} ~ {data?.schedule.work_end ?? "--:--"})
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div className="rounded-md border bg-muted/20 p-2">출근: {fmtDateTime(data?.attendance?.check_in_at ?? null)}</div>
        <div className="rounded-md border bg-muted/20 p-2">퇴근: {fmtDateTime(data?.attendance?.check_out_at ?? null)}</div>
        <div className="rounded-md border bg-muted/20 p-2">근무시간: {workedLabel}</div>
        <div className="rounded-md border bg-muted/20 p-2">상태: {data?.attendance?.attendance_status ?? "-"}</div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={doCheckIn} disabled={isLoading}>출근</Button>
        <Button size="sm" variant="outline" onClick={doCheckOut} disabled={isLoading}>퇴근</Button>
      </div>
    </div>
  );
}
