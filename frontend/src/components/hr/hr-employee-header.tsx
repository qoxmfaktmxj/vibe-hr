"use client";

import { ChevronDown, ChevronUp, Search, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { EmployeeItem, EmployeeListResponse } from "@/types/employee";

type Props = {
  selectedEmployee: EmployeeItem | null;
  onSelectEmployee: (employee: EmployeeItem) => void;
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

export function HrEmployeeHeader({ selectedEmployee: selected, onSelectEmployee }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const keyword = query.trim();
  const searchKey = keyword && keyword === debouncedQuery
    ? [
        `/api/employees?page=1&limit=8&name=${encodeURIComponent(keyword)}`,
        `/api/employees?page=1&limit=8&employee_no=${encodeURIComponent(keyword)}`,
      ]
    : null;
  const { data: results } = useSWR<EmployeeItem[]>(searchKey, async (urls: string[]) => {
    const responses = await Promise.all(urls.map((url) => fetcher<EmployeeListResponse>(url)));
    return [...new Map(responses.flatMap((response) => response.employees).map((item) => [item.id, item])).values()].slice(0, 8);
  }, { revalidateOnFocus: false });
  const filtered = keyword === debouncedQuery ? results ?? [] : [];

  return (
    <Card className="mb-4 rounded-none border-0 bg-transparent py-0 shadow-none">
      <CardContent className="px-0 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar className="h-10 w-10 border border-border bg-card">
            <AvatarFallback className="bg-card text-foreground"><UserCircle2 className="h-5 w-5" /></AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-xl font-bold text-foreground">{selected?.display_name ?? "-"}</span>
              <Badge variant="outline">{selected?.department_name ?? "-"}</Badge>
              <Badge variant="secondary">{selected?.position_title ?? "-"}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              사번 {selected?.employee_no ?? "-"} / 입사일 {selected?.hire_date ?? "-"} / 근속 {tenureText(selected?.hire_date)}
            </p>
          </div>

          <div className="relative w-full sm:w-[220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input aria-label="사번/이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="사번/이름 검색" className="h-9 pl-8" />
            </div>
            {query ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-32 overflow-auto rounded-md border bg-card shadow-lg">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => {
                      onSelectEmployee(item);
                      setQuery("");
                    }}
                  >
                    <span>{item.display_name}</span>
                    <span className="text-muted-foreground">{item.employee_no}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" aria-label={expanded ? "구성원 요약 접기" : "구성원 요약 펼치기"} aria-expanded={expanded} className="rounded-md border bg-card p-2 hover:bg-accent" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {expanded ? (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-sm lg:grid-cols-5">
            <div><p className="text-xs text-muted-foreground">성명</p><p className="font-semibold">{selected?.display_name ?? "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">부서</p><p className="font-semibold">{selected?.department_name ?? "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">직무</p><p className="font-semibold">{selected?.position_title ?? "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">입사일</p><p className="font-semibold">{selected?.hire_date ?? "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">근속기간</p><p className="font-semibold">{tenureText(selected?.hire_date)}</p></div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
