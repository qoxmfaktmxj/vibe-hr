"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { OrganizationDepartmentListResponse } from "@/types/organization";
import type {
  TimDepartmentScheduleAssignmentListResponse,
  TimSchedulePatternListResponse,
} from "@/types/tim";

export function DepartmentScheduleAssignmentManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/tim/work-codes");
  const queryEnabled = !menuActionLoading && can("query");
  const saveDisabled = menuActionLoading || !can("save");

  const { data: patterns } = useSWR<TimSchedulePatternListResponse>(
    queryEnabled ? "/api/tim/schedules/patterns" : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: departments } = useSWR<OrganizationDepartmentListResponse>(
    queryEnabled ? "/api/org/departments?all=true" : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data, isLoading } = useSWR<TimDepartmentScheduleAssignmentListResponse>(
    queryEnabled ? "/api/tim/schedules/departments" : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const patternOptions = patterns?.items ?? [];
  const departmentOptions = departments?.departments ?? [];
  const rows = data?.items ?? [];

  const [departmentId, setDepartmentId] = useState("");
  const [patternId, setPatternId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [priority, setPriority] = useState("100");

  const canSubmit = useMemo(
    () => Number(departmentId) > 0 && Number(patternId) > 0,
    [departmentId, patternId],
  );

  async function addAssignment() {
    if (saveDisabled) return;
    if (!canSubmit) {
      toast.error("조직과 근무패턴을 선택해 주세요.");
      return;
    }

    const response = await fetch("/api/tim/schedules/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: null,
            department_id: Number(departmentId),
            pattern_id: Number(patternId),
            effective_from: effectiveFrom,
            effective_to: effectiveTo || null,
            priority: Number(priority) || 100,
            is_active: true,
          },
        ],
        delete_ids: [],
      }),
    });
    const json = (await response.json().catch(() => null)) as { detail?: string } | null;
    if (!response.ok) {
      toast.error(json?.detail ?? "부서 기본 근무패턴 저장에 실패했습니다.");
      return;
    }

    toast.success("부서 기본 근무패턴을 저장했습니다.");
    await mutate("/api/tim/schedules/departments");
  }

  async function removeAssignment(id: number) {
    if (saveDisabled) return;

    const response = await fetch("/api/tim/schedules/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [], delete_ids: [id] }),
    });
    const json = (await response.json().catch(() => null)) as { detail?: string } | null;
    if (!response.ok) {
      toast.error(json?.detail ?? "부서 기본 근무패턴 삭제에 실패했습니다.");
      return;
    }

    toast.success("부서 기본 근무패턴을 삭제했습니다.");
    await mutate("/api/tim/schedules/departments");
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">부서 기본 근무패턴</h3>

      <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-5">
        <select
          className="h-9 rounded-md border bg-card px-2 text-sm"
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          disabled={!queryEnabled}
        >
          <option value="">조직 선택</option>
          {departmentOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} / {item.name} / {item.cost_center_code ?? "-"}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-card px-2 text-sm"
          value={patternId}
          onChange={(event) => setPatternId(event.target.value)}
          disabled={!queryEnabled}
        >
          <option value="">패턴 선택</option>
          {patternOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} / {item.name}
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
        <div className="flex gap-2">
          <Input
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            placeholder="우선순위"
          />
          <Button onClick={addAssignment} disabled={saveDisabled || !canSubmit}>
            추가
          </Button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2">조직코드</th>
              <th className="py-2">조직명</th>
              <th className="py-2">조직구분</th>
              <th className="py-2">COST CENTER</th>
              <th className="py-2">인원</th>
              <th className="py-2">근무패턴</th>
              <th className="py-2">시작</th>
              <th className="py-2">종료</th>
              <th className="py-2">우선순위</th>
              <th className="py-2">동작</th>
            </tr>
          </thead>
          <tbody>
            {!queryEnabled ? (
              <tr>
                <td colSpan={10} className="py-3 text-muted-foreground">
                  조회 권한이 없습니다.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2">{row.department_code}</td>
                <td className="py-2">{row.department_name}</td>
                <td className="py-2">{row.organization_type ?? "-"}</td>
                <td className="py-2">{row.cost_center_code ?? "-"}</td>
                <td className="py-2">{row.employee_count}</td>
                <td className="py-2">{row.pattern_name ?? row.pattern_code ?? row.pattern_id}</td>
                <td className="py-2">{row.effective_from}</td>
                <td className="py-2">{row.effective_to ?? "-"}</td>
                <td className="py-2">{row.priority}</td>
                <td className="py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeAssignment(row.id)}
                    disabled={saveDisabled}
                  >
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
            {queryEnabled && rows.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={10} className="py-3 text-muted-foreground">
                  등록된 부서 기본 근무패턴이 없습니다.
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-3 text-muted-foreground">
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
