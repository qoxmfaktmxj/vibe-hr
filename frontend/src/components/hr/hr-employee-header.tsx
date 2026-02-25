"use client";

import { ChevronDown, ChevronUp, Search, UserCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EmployeeItem } from "@/types/employee";

type Props = {
  employees: EmployeeItem[];
  selectedEmployeeId: number | null;
  onSelectEmployee: (id: number) => void;
};

function tenureText(hireDate?: string): string {
  if (!hireDate) return "-";
  const start = new Date(hireDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y}년 ${m}개월`;
}

export function HrEmployeeHeader({ employees, selectedEmployeeId, onSelectEmployee }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return employees.slice(0, 8);
    return employees
      .filter((item) => item.display_name.toLowerCase().includes(keyword) || item.employee_no.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [employees, query]);

  const selected = useMemo(() => employees.find((item) => item.id === selectedEmployeeId) ?? null, [employees, selectedEmployeeId]);

  return (
    <Card className="mx-4 mt-4 border border-border bg-card/70 shadow-sm lg:mx-8">
      <CardContent className="p-3 lg:p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border bg-card">
            <AvatarFallback className="bg-card text-foreground"><UserCircle2 className="h-5 w-5" /></AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-bold text-foreground">{selected?.display_name ?? "-"}</span>
              <Badge variant="outline">{selected?.department_name ?? "-"}</Badge>
              <Badge variant="secondary">{selected?.position_title ?? "-"}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              사번 {selected?.employee_no ?? "-"} · 입사일 {selected?.hire_date ?? "-"} · 근속 {tenureText(selected?.hire_date)}
            </p>
          </div>

          <div className="relative w-[220px] max-w-[45vw]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="사번/이름 검색" className="h-9 pl-8" />
            </div>
            {query ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-32 overflow-auto rounded-md border bg-white shadow-lg">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                    onClick={() => {
                      onSelectEmployee(item.id);
                      setQuery("");
                    }}
                  >
                    <span>{item.display_name}</span>
                    <span className="text-slate-500">{item.employee_no}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" className="rounded-md border bg-white p-2 hover:bg-slate-100" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {expanded ? (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-sm lg:grid-cols-5">
            <div><p className="text-xs text-slate-500">성명</p><p className="font-semibold">{selected?.display_name ?? "-"}</p></div>
            <div><p className="text-xs text-slate-500">부서</p><p className="font-semibold">{selected?.department_name ?? "-"}</p></div>
            <div><p className="text-xs text-slate-500">직무</p><p className="font-semibold">{selected?.position_title ?? "-"}</p></div>
            <div><p className="text-xs text-slate-500">입사일</p><p className="font-semibold">{selected?.hire_date ?? "-"}</p></div>
            <div><p className="text-xs text-slate-500">근속기간</p><p className="font-semibold">{tenureText(selected?.hire_date)}</p></div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
