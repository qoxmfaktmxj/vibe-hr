"use client";

import { Search, UserCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EmployeeItem } from "@/types/employee";
import type { HrEmployeeSummary } from "@/types/hr-employee-profile";

type Props = {
  selectedEmployeeId: number | null;
  onSelectEmployee: (id: number) => void;
};

function toSummary(employee: EmployeeItem): HrEmployeeSummary {
  return {
    id: employee.id,
    employee_no: employee.employee_no,
    display_name: employee.display_name,
    department_name: employee.department_name,
    position_title: employee.position_title,
    birth_date: null,
    job_family: null,
    job_role: employee.position_title,
    grade: null,
  };
}

function field(label: string, value?: string | null) {
  return (
    <div className="rounded-lg border bg-white/70 px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value || "-"}</p>
    </div>
  );
}

export function HrEmployeeHeader({ selectedEmployeeId, onSelectEmployee }: Props) {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/employees", { cache: "no-store" });
      if (!response.ok) return;
      const json = (await response.json()) as { employees?: EmployeeItem[] };
      const rows = json.employees ?? [];
      setEmployees(rows);
      if (!selectedEmployeeId && rows.length > 0) {
        onSelectEmployee(rows[0].id);
      }
    }
    void load();
  }, [onSelectEmployee, selectedEmployeeId]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return employees.slice(0, 8);
    return employees
      .filter(
        (item) =>
          item.display_name.toLowerCase().includes(keyword) ||
          item.employee_no.toLowerCase().includes(keyword),
      )
      .slice(0, 8);
  }, [employees, query]);

  const selected = useMemo(
    () => employees.find((item) => item.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );
  const summary = selected ? toSummary(selected) : null;

  return (
    <Card className="mx-4 mt-4 border-0 bg-gradient-to-r from-indigo-50 via-sky-50 to-white shadow-sm lg:mx-8">
      <CardContent className="grid gap-4 p-5 lg:min-h-[210px] lg:grid-cols-[1.3fr_1fr] lg:gap-6">
        <div className="flex gap-4">
          <Avatar className="h-20 w-20 border bg-white shadow-sm">
            <AvatarFallback className="bg-white text-slate-700">
              <UserCircle2 className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs text-slate-500">인사 컨텍스트</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{summary?.display_name ?? "-"}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary">사번 {summary?.employee_no ?? "-"}</Badge>
                <Badge variant="outline">부서 {summary?.department_name ?? "-"}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {field("생년월일", summary?.birth_date)}
              {field("직무", summary?.job_role)}
              {field("직군", summary?.job_family)}
              {field("직급", summary?.grade)}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white/90 p-3">
          <label className="mb-2 block text-xs font-semibold text-slate-600">대상자 검색 (사번/이름)</label>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="예) EMP-000123 / 김민수"
              className="pl-9"
            />
          </div>
          <div className="max-h-[132px] space-y-1 overflow-auto">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectEmployee(item.id)}
                className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-sm ${
                  item.id === selectedEmployeeId
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="font-medium">{item.display_name}</span>
                <span className="text-xs text-slate-500">{item.employee_no}</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
