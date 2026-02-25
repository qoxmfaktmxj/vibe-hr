"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimAnnualLeaveListResponse, TimAnnualLeaveResponse } from "@/types/tim";

export function AnnualLeaveManager() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [employeeId, setEmployeeId] = useState(0);
  const [adjustmentDays, setAdjustmentDays] = useState(0);
  const [reason, setReason] = useState("");
  const [keyword, setKeyword] = useState("");

  const { data } = useSWR<TimAnnualLeaveResponse>(`/api/tim/annual-leave/my?year=${year}`, fetcher, {
    revalidateOnFocus: false,
  });

  const listKey = `/api/tim/annual-leave/list?year=${year}${keyword.trim() ? `&keyword=${encodeURIComponent(keyword.trim())}` : ""}`;
  const { data: listData, isLoading: isListLoading } = useSWR<TimAnnualLeaveListResponse>(listKey, fetcher, {
    revalidateOnFocus: false,
  });

  async function adjust() {
    if (!employeeId) return toast.error("직원 ID를 입력하세요.");
    if (!reason.trim()) return toast.error("조정 사유를 입력하세요.");

    const response = await fetch("/api/tim/annual-leave/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, year, adjustment_days: adjustmentDays, reason }),
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { detail?: string } | null;
      return toast.error(json?.detail ?? "조정 실패");
    }

    toast.success("연차 조정 완료");
    await mutate(`/api/tim/annual-leave/my?year=${year}`);
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">내 연차 현황</h2>
        <div className="mt-3 flex gap-2">
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32" />
          <Button variant="outline" onClick={() => mutate(`/api/tim/annual-leave/my?year=${year}`)}>조회</Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div className="rounded border bg-muted/30 p-3">발생: {data?.item.granted_days ?? "-"}</div>
          <div className="rounded border bg-muted/30 p-3">사용: {data?.item.used_days ?? "-"}</div>
          <div className="rounded border bg-muted/30 p-3">이월: {data?.item.carried_over_days ?? "-"}</div>
          <div className="rounded border bg-muted/30 p-3">잔여: {data?.item.remaining_days ?? "-"}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">관리자 연차 조정</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <Input type="number" placeholder="employee_id" value={employeeId || ""} onChange={(e) => setEmployeeId(Number(e.target.value))} />
          <Input type="number" placeholder="조정일수 (+/-)" value={adjustmentDays} onChange={(e) => setAdjustmentDays(Number(e.target.value))} />
          <Input placeholder="사유" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={adjust}>조정 저장</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">개인별 휴가 누적 현황 (3번 화면)</h3>
          <div className="flex gap-2">
            <Input placeholder="사번/성명 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-56" />
            <Button variant="outline" onClick={() => mutate(listKey)}>조회</Button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">부서</th>
                <th className="py-2">사번</th>
                <th className="py-2">성명</th>
                <th className="py-2">발생</th>
                <th className="py-2">사용</th>
                <th className="py-2">이월</th>
                <th className="py-2">잔여</th>
              </tr>
            </thead>
            <tbody>
              {(listData?.items ?? []).map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.department_name ?? "-"}</td>
                  <td className="py-2">{item.employee_no}</td>
                  <td className="py-2">{item.employee_name}</td>
                  <td className="py-2">{item.granted_days}</td>
                  <td className="py-2">{item.used_days}</td>
                  <td className="py-2">{item.carried_over_days}</td>
                  <td className="py-2 font-semibold">{item.remaining_days}</td>
                </tr>
              ))}
              {isListLoading ? <tr><td colSpan={7} className="py-3 text-muted-foreground">불러오는 중...</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
