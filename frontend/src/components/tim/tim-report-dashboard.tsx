"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { TimReportSummaryResponse } from "@/types/tim";

export function TimReportDashboard() {
  const { data, isLoading } = useSWR<TimReportSummaryResponse>("/api/tim/reports/summary", fetcher, {
    revalidateOnFocus: false,
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">근태 리포트를 불러오는 중...</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-slate-500">리포트 데이터가 없습니다.</div>;
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">근태 집계 건수</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_attendance_records.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">휴가 신청 건수</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_leave_requests.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">기간</p>
          <p className="mt-1 text-sm font-medium">{data.start_date} ~ {data.end_date}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold">상태별 근태 건수</h3>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          <div>정상: <b>{data.status_counts.present}</b></div>
          <div>지각: <b>{data.status_counts.late}</b></div>
          <div>결근: <b>{data.status_counts.absent}</b></div>
          <div>휴가: <b>{data.status_counts.leave}</b></div>
          <div>재택: <b>{data.status_counts.remote}</b></div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold">부서별 출근율</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2">부서</th>
                <th className="py-2">집계건수</th>
                <th className="py-2">출근율</th>
                <th className="py-2">지각율</th>
                <th className="py-2">결근율</th>
              </tr>
            </thead>
            <tbody>
              {data.department_summaries.map((item) => (
                <tr key={item.department_id} className="border-b last:border-b-0">
                  <td className="py-2">{item.department_name}</td>
                  <td className="py-2">{item.attendance_count}</td>
                  <td className="py-2">{item.present_rate}%</td>
                  <td className="py-2">{item.late_rate}%</td>
                  <td className="py-2">{item.absent_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
