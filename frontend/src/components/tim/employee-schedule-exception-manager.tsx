"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { TimEmployeeScheduleExceptionListResponse, TimSchedulePatternListResponse } from "@/types/tim";

export function EmployeeScheduleExceptionManager() {
  const { data: patterns } = useSWR<TimSchedulePatternListResponse>("/api/tim/schedules/patterns", fetcher, { revalidateOnFocus: false });
  const { data, isLoading } = useSWR<TimEmployeeScheduleExceptionListResponse>("/api/tim/schedules/exceptions/employees", fetcher, { revalidateOnFocus: false });

  const patternOptions = patterns?.items ?? [];
  const [employeeId, setEmployeeId] = useState("");
  const [patternId, setPatternId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [reason, setReason] = useState("");

  const rows = data?.items ?? [];
  const canSave = useMemo(() => Number(employeeId) > 0 && Number(patternId) > 0, [employeeId, patternId]);

  async function addException() {
    if (!canSave) return toast.error("employee_id / pattern 선택 필요");

    const payload = {
      items: [
        {
          id: null,
          employee_id: Number(employeeId),
          pattern_id: Number(patternId),
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null,
          reason: reason || null,
          priority: 1000,
          is_active: true,
        },
      ],
      delete_ids: [],
    };

    const res = await fetch("/api/tim/schedules/exceptions/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as { detail?: string } | null;
    if (!res.ok) return toast.error(json?.detail ?? "저장 실패");

    toast.success("예외 스케줄 저장 완료");
    setReason("");
    await mutate("/api/tim/schedules/exceptions/employees");
  }

  async function removeException(id: number) {
    const res = await fetch("/api/tim/schedules/exceptions/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [], delete_ids: [id] }),
    });
    if (!res.ok) return toast.error("삭제 실패");
    toast.success("삭제 완료");
    await mutate("/api/tim/schedules/exceptions/employees");
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">개인 예외 스케줄 관리</h3>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-6">
        <Input placeholder="employee_id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        <select className="h-9 rounded-md border bg-card px-2 text-sm" value={patternId} onChange={(e) => setPatternId(e.target.value)}>
          <option value="">패턴 선택</option>
          {patternOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
        <Input placeholder="사유" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button onClick={addException}>추가</Button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2">ID</th>
              <th className="py-2">사번ID</th>
              <th className="py-2">패턴ID</th>
              <th className="py-2">시작</th>
              <th className="py-2">종료</th>
              <th className="py-2">사유</th>
              <th className="py-2">동작</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2">{row.id}</td>
                <td className="py-2">{row.employee_id}</td>
                <td className="py-2">{row.pattern_id}</td>
                <td className="py-2">{row.effective_from}</td>
                <td className="py-2">{row.effective_to ?? "-"}</td>
                <td className="py-2">{row.reason ?? "-"}</td>
                <td className="py-2"><Button size="sm" variant="outline" onClick={() => removeException(row.id)}>삭제</Button></td>
              </tr>
            ))}
            {isLoading ? <tr><td colSpan={7} className="py-3 text-muted-foreground">불러오는 중...</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
