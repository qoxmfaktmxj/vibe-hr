"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimLeaveRequestListResponse } from "@/types/tim";

export function LeaveApprovalManager() {
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useSWR<TimLeaveRequestListResponse>("/api/tim/leave-requests?pending_only=true", fetcher, {
    revalidateOnFocus: false,
  });

  async function approve(id: number) {
    const response = await fetch(`/api/tim/leave-requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!response.ok) return toast.error("승인 실패");
    toast.success("승인 완료");
    await mutate("/api/tim/leave-requests?pending_only=true");
  }

  async function reject(id: number) {
    const response = await fetch(`/api/tim/leave-requests/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason || "반려" }),
    });

    if (!response.ok) return toast.error("반려 실패");
    toast.success("반려 완료");
    setRejectReason("");
    await mutate("/api/tim/leave-requests?pending_only=true");
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-base font-semibold">승인 대기 목록</h2>
        <Input placeholder="반려 사유(선택)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="max-w-md" />

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">사번</th>
                <th className="py-2">이름</th>
                <th className="py-2">유형</th>
                <th className="py-2">기간</th>
                <th className="py-2">사유</th>
                <th className="py-2">동작</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.employee_no}</td>
                  <td className="py-2">{item.employee_name}</td>
                  <td className="py-2">{item.leave_type}</td>
                  <td className="py-2">{item.start_date} ~ {item.end_date}</td>
                  <td className="py-2">{item.reason ?? "-"}</td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => approve(item.id)}>승인</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(item.id)}>반려</Button>
                    </div>
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
