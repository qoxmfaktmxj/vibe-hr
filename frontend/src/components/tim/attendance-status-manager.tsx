"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimAttendanceDailyListResponse } from "@/types/tim";

export function AttendanceStatusManager() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate, page: "1", limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    return `/api/tim/attendance-daily?${params.toString()}`;
  }, [startDate, endDate, statusFilter]);

  const { data, isLoading, mutate } = useSWR<TimAttendanceDailyListResponse>(query, fetcher, { revalidateOnFocus: false });

  async function goCorrection(id: number) {
    router.push(`/tim/correction?attendance_id=${id}`);
  }

  return (
    <div className="space-y-3 p-6">
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <select className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">상태 전체</option>
            <option value="present">present</option>
            <option value="late">late</option>
            <option value="absent">absent</option>
            <option value="leave">leave</option>
            <option value="remote">remote</option>
          </select>
          <Button variant="outline" onClick={() => mutate()}>{isLoading ? "조회중..." : "조회"}</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">총 {data?.total_count ?? 0}건</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">사번</th>
                <th className="py-2">이름</th>
                <th className="py-2">부서</th>
                <th className="py-2">날짜</th>
                <th className="py-2">출근</th>
                <th className="py-2">퇴근</th>
                <th className="py-2">상태</th>
                <th className="py-2">수정</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.employee_no}</td>
                  <td className="py-2">{item.employee_name}</td>
                  <td className="py-2">{item.department_name}</td>
                  <td className="py-2">{item.work_date}</td>
                  <td className="py-2">{item.check_in_at ? new Date(item.check_in_at).toLocaleTimeString("ko-KR") : "-"}</td>
                  <td className="py-2">{item.check_out_at ? new Date(item.check_out_at).toLocaleTimeString("ko-KR") : "-"}</td>
                  <td className="py-2">{item.attendance_status}</td>
                  <td className="py-2"><Button size="sm" variant="outline" onClick={() => goCorrection(item.id)}>수정</Button></td>
                </tr>
              ))}
              {isLoading ? (
                <tr><td className="py-3 text-muted-foreground" colSpan={8}>불러오는 중...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
