"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  TimEmployeeScheduleExceptionListResponse,
  TimSchedulePatternListResponse,
} from "@/types/tim";

export function EmployeeScheduleExceptionManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/tim/work-codes");
  const queryEnabled = !menuActionLoading && can("query");
  const saveDisabled = menuActionLoading || !can("save");

  const { data: patterns } = useSWR<TimSchedulePatternListResponse>(
    queryEnabled ? "/api/tim/schedules/patterns" : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data, isLoading } = useSWR<TimEmployeeScheduleExceptionListResponse>(
    queryEnabled ? "/api/tim/schedules/exceptions/employees" : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const patternOptions = patterns?.items ?? [];
  const [employeeId, setEmployeeId] = useState("");
  const [patternId, setPatternId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [reason, setReason] = useState("");

  const rows = data?.items ?? [];
  const canSubmit = useMemo(
    () => Number(employeeId) > 0 && Number(patternId) > 0,
    [employeeId, patternId],
  );

  async function addException() {
    if (saveDisabled) return;
    if (!canSubmit) {
      toast.error("사원 ID와 패턴을 선택해 주세요.");
      return;
    }

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

    const response = await fetch("/api/tim/schedules/exceptions/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await response.json().catch(() => null)) as { detail?: string } | null;
    if (!response.ok) {
      toast.error(json?.detail ?? "개인 예외 저장에 실패했습니다.");
      return;
    }

    toast.success("개인 예외를 저장했습니다.");
    setReason("");
    await mutate("/api/tim/schedules/exceptions/employees");
  }

  async function removeException(id: number) {
    if (saveDisabled) return;

    const response = await fetch("/api/tim/schedules/exceptions/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [], delete_ids: [id] }),
    });
    const json = (await response.json().catch(() => null)) as { detail?: string } | null;
    if (!response.ok) {
      toast.error(json?.detail ?? "개인 예외 삭제에 실패했습니다.");
      return;
    }

    toast.success("개인 예외를 삭제했습니다.");
    await mutate("/api/tim/schedules/exceptions/employees");
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">개인 예외 스케줄 관리</h3>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-6">
        <Input
          placeholder="employee_id"
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
        />
        <select
          className="h-9 rounded-md border bg-card px-2 text-sm"
          value={patternId}
          onChange={(event) => setPatternId(event.target.value)}
          disabled={!queryEnabled}
        >
          <option value="">패턴 선택</option>
          {patternOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
        <Input
          type="date"
          value={effectiveTo}
          onChange={(event) => setEffectiveTo(event.target.value)}
        />
        <Input
          placeholder="사유"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <Button onClick={addException} disabled={saveDisabled || !canSubmit}>
          추가
        </Button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2">ID</th>
              <th className="py-2">사원 ID</th>
              <th className="py-2">패턴 ID</th>
              <th className="py-2">시작</th>
              <th className="py-2">종료</th>
              <th className="py-2">사유</th>
              <th className="py-2">동작</th>
            </tr>
          </thead>
          <tbody>
            {!queryEnabled ? (
              <tr>
                <td colSpan={7} className="py-3 text-muted-foreground">
                  조회 권한이 없습니다.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2">{row.id}</td>
                <td className="py-2">{row.employee_id}</td>
                <td className="py-2">{row.pattern_id}</td>
                <td className="py-2">{row.effective_from}</td>
                <td className="py-2">{row.effective_to ?? "-"}</td>
                <td className="py-2">{row.reason ?? "-"}</td>
                <td className="py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeException(row.id)}
                    disabled={saveDisabled}
                  >
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
            {queryEnabled && rows.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7} className="py-3 text-muted-foreground">
                  등록된 개인 예외가 없습니다.
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-3 text-muted-foreground">
                  데이터를 불러오는 중입니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
