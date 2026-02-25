"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TimScheduleGenerateRequest, TimScheduleGenerateResponse } from "@/types/tim";

export function ScheduleGeneratorManager() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [target, setTarget] = useState<"all" | "department" | "employee">("all");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeIdsText, setEmployeeIdsText] = useState("");
  const [dateFrom, setDateFrom] = useState(first);
  const [dateTo, setDateTo] = useState(last);
  const [mode, setMode] = useState<"create_if_missing" | "overwrite">("create_if_missing");
  const [loading, setLoading] = useState(false);

  async function generate() {
    const employee_ids = employeeIdsText
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);

    const payload: TimScheduleGenerateRequest = {
      target,
      date_from: dateFrom,
      date_to: dateTo,
      mode,
      ...(target === "department" && departmentId ? { department_id: Number(departmentId) } : {}),
      ...(target === "employee" && employee_ids.length > 0 ? { employee_ids } : {}),
    };

    setLoading(true);
    try {
      const res = await fetch("/api/tim/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as TimScheduleGenerateResponse & { detail?: string };
      if (!res.ok) throw new Error(json?.detail ?? "스케줄 생성 실패");
      toast.success(`생성 ${json.created_count} / 갱신 ${json.updated_count} / 스킵 ${json.skipped_count}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "스케줄 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">근무스케줄 생성</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <select
          className="h-9 rounded-md border bg-card px-2 text-sm"
          value={target}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "all" || next === "department" || next === "employee") setTarget(next);
          }}
        >
          <option value="all">전체</option>
          <option value="department">부서</option>
          <option value="employee">개인</option>
        </select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {target === "department" ? (
        <div className="mt-2"><Input placeholder="department_id" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} /></div>
      ) : null}

      {target === "employee" ? (
        <div className="mt-2"><Input placeholder="employee_ids (예: 3,4,5)" value={employeeIdsText} onChange={(e) => setEmployeeIdsText(e.target.value)} /></div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <select
          className="h-9 rounded-md border bg-card px-2 text-sm"
          value={mode}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "create_if_missing" || next === "overwrite") setMode(next);
          }}
        >
          <option value="create_if_missing">미생성만 생성</option>
          <option value="overwrite">덮어쓰기</option>
        </select>
        <Button onClick={generate} disabled={loading}>{loading ? "생성 중..." : "근무스케줄 생성"}</Button>
      </div>
    </div>
  );
}
