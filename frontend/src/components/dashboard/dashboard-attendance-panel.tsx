"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { useAuth } from "@/components/auth/auth-provider";
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

function parseUtcDate(value: string): Date {
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

function fmtTimeOnly(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parseUtcDate(value));
}

function toAttendanceStatusLabel(status: string | null | undefined) {
  if (!status) return "-";
  if (status === "present") return "정상출근";
  if (status === "late") return "지각";
  if (status === "absent") return "결근";
  if (status === "leave") return "휴가";
  if (status === "remote") return "원격";
  return status;
}

type DashboardAttendancePanelProps = {
  compact?: boolean;
};

export function DashboardAttendancePanel({ compact = false }: DashboardAttendancePanelProps) {
  const { user } = useAuth();
  // SSR hydration mismatch 방지: 초기값 null, 클라이언트 마운트 후 설정
  const [clock, setClock] = useState<string | null>(null);
  const scheduleKey = user?.id ? `/api/tim/attendance-daily/today-schedule?user_id=${user.id}` : "/api/tim/attendance-daily/today-schedule";
  const { data, isLoading } = useSWR<TimTodayScheduleResponse>(scheduleKey, fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    setClock(getKoreaDateTime());
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
    await mutate(scheduleKey);
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
    await mutate(scheduleKey);
  }

  const dayTypeLabel =
    data?.schedule.day_type === "holiday"
      ? `공휴일${data.schedule.holiday_name ? ` (${data.schedule.holiday_name})` : ""}`
      : data?.schedule.day_type === "weekend"
        ? "주말"
        : "근무일";

  return (
    <div className={`rounded-xl border bg-card p-4 ${compact ? "h-full" : ""}`}>
      <div className="space-y-1">
        <p className="font-mono text-lg font-semibold tracking-wide">{clock ?? "\u00a0"}</p>
        <div className="text-xs text-muted-foreground">
          <p>구분: {dayTypeLabel ?? "-"}</p>
          <p>
            스케줄: {data?.schedule.schedule_name ?? "-"} ({data?.schedule.work_start ?? "--:--"} ~ {data?.schedule.work_end ?? "--:--"})
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border bg-muted/20 p-3">출근: {fmtTimeOnly(data?.attendance?.check_in_at ?? null)}</div>
        <div className="rounded-md border bg-muted/20 p-3">근무시간: {workedLabel}</div>
        <div className="rounded-md border bg-muted/20 p-3">퇴근: {fmtTimeOnly(data?.attendance?.check_out_at ?? null)}</div>
        <div className="rounded-md border bg-muted/20 p-3">상태: {toAttendanceStatusLabel(data?.attendance?.attendance_status)}</div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <div className="rounded-md border bg-muted/10 p-2">지각 판정: {data?.derived.is_late ? "Y" : "N"}</div>
        <div className="rounded-md border bg-muted/10 p-2">야근(분): {data?.derived.overtime_minutes ?? 0}</div>
        <div className="rounded-md border bg-muted/10 p-2">주말/휴일 근무: {data?.derived.is_weekend_work ? "Y" : "N"}</div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={doCheckIn} disabled={isLoading}>출근</Button>
        <Button size="sm" variant="outline" onClick={doCheckOut} disabled={isLoading}>퇴근</Button>
      </div>
    </div>
  );
}
