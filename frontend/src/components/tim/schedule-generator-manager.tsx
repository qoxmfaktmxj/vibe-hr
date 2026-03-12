"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { TimScheduleGenerateRequest, TimScheduleGenerateResponse } from "@/types/tim";

export function ScheduleGeneratorManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/tim/work-codes");
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
    if (menuActionLoading || !can("save")) return;

    const employeeIds = employeeIdsText
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    const payload: TimScheduleGenerateRequest = {
      target,
      date_from: dateFrom,
      date_to: dateTo,
      mode,
      ...(target === "department" && departmentId ? { department_id: Number(departmentId) } : {}),
      ...(target === "employee" && employeeIds.length > 0 ? { employee_ids: employeeIds } : {}),
    };

    setLoading(true);
    try {
      const response = await fetch("/api/tim/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => null)) as
        | (TimScheduleGenerateResponse & { detail?: string })
        | null;
      if (!response.ok) {
        throw new Error(json?.detail ?? "스케줄 생성에 실패했습니다.");
      }
      if (!json) {
        throw new Error("스케줄 생성 결과를 불러오지 못했습니다.");
      }
      toast.success(
        `생성 ${json.created_count} / 갱신 ${json.updated_count} / 건너뜀 ${json.skipped_count}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "스케줄 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">근무 스케줄 생성</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <select
          className="h-9 rounded-md border bg-card px-2 text-sm"
          value={target}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "all" || next === "department" || next === "employee") {
              setTarget(next);
            }
          }}
        >
          <option value="all">전체</option>
          <option value="department">부서</option>
          <option value="employee">개인</option>
        </select>
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </div>

      {target === "department" ? (
        <div className="mt-2">
          <Input
            placeholder="department_id"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          />
        </div>
      ) : null}

      {target === "employee" ? (
        <div className="mt-2">
          <Input
            placeholder="employee_ids (예: 3,4,5)"
            value={employeeIdsText}
            onChange={(event) => setEmployeeIdsText(event.target.value)}
          />
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <select
          className="h-9 rounded-md border bg-card px-2 text-sm"
          value={mode}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "create_if_missing" || next === "overwrite") {
              setMode(next);
            }
          }}
        >
          <option value="create_if_missing">미생성 건만 생성</option>
          <option value="overwrite">덮어쓰기</option>
        </select>
        <Button onClick={generate} disabled={loading || menuActionLoading || !can("save")}>
          {loading ? "생성 중..." : "근무 스케줄 생성"}
        </Button>
      </div>
    </div>
  );
}
