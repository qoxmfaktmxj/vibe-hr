"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimLeaveRequestListResponse } from "@/types/tim";

export function LeaveRequestManager() {
  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  const { data, isLoading } = useSWR<TimLeaveRequestListResponse>("/api/tim/leave-requests/my", fetcher, {
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
    await mutate("/api/tim/leave-requests/my");
  }

  async function cancelRequest(id: number) {
    if (!confirm("해당 신청을 취소할까요?")) return;
    const response = await fetch(`/api/tim/leave-requests/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "사용자 취소" }),
    });

    if (!response.ok) return toast.error("취소 실패");
    toast.success("취소 완료");
    await mutate("/api/tim/leave-requests/my");
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">휴가 신청</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <select className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            <option value="annual">annual</option>
            <option value="sick">sick</option>
            <option value="half_day">half_day</option>
            <option value="unpaid">unpaid</option>
            <option value="other">other</option>
          </select>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Input placeholder="사유" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="mt-3"><Button onClick={submit}>신청</Button></div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">내 신청 목록</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">유형</th>
                <th className="py-2">기간</th>
                <th className="py-2">일수</th>
                <th className="py-2">상태</th>
                <th className="py-2">사유</th>
                <th className="py-2">동작</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.leave_type}</td>
                  <td className="py-2">{item.start_date} ~ {item.end_date}</td>
                  <td className="py-2">{item.leave_days}</td>
                  <td className="py-2">{item.request_status}</td>
                  <td className="py-2">{item.reason ?? "-"}</td>
                  <td className="py-2">
                    {item.request_status === "pending" ? (
                      <Button size="sm" variant="outline" onClick={() => cancelRequest(item.id)}>취소</Button>
                    ) : "-"}
                  </td>
                </tr>
              ))}
              {isLoading ? <tr><td className="py-3 text-muted-foreground" colSpan={6}>불러오는 중...</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
