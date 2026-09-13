"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EmployeeGridRow } from "./employee-master-types";

const dimensions = { department_name: "부서", position_title: "직책", employment_status: "재직상태" } as const;
type Dimension = keyof typeof dimensions;
const label = (row: EmployeeGridRow, key: Dimension) => key === "employment_status" ? ({ active: "재직", leave: "휴직", resigned: "퇴직" }[row.employment_status]) : row[key] || "미지정";

export function EmployeeAnalysis({ rows, onClose, onDetail }: { rows: EmployeeGridRow[] | null; onClose: () => void; onDetail: (id: number) => void }) {
  const [mode, setMode] = useState<"group" | "pivot" | "chart">("group");
  const [groupBy, setGroupBy] = useState<Dimension>("department_name");
  const [pivotBy, setPivotBy] = useState<Dimension>("employment_status");
  const groups = useMemo(() => {
    const result = new Map<string, EmployeeGridRow[]>();
    for (const row of rows ?? []) { const key = label(row, groupBy); result.set(key, [...(result.get(key) ?? []), row]); }
    return [...result.entries()].sort((a, b) => a[0].localeCompare(b[0], "ko"));
  }, [rows, groupBy]);
  const pivotColumns = [...new Set((rows ?? []).map((row) => label(row, pivotBy)))].sort();
  const max = Math.max(1, ...groups.map(([, items]) => items.length));
  return <Dialog open={rows !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>사원 분석</DialogTitle><DialogDescription>열었을 때 현재 페이지의 필터 결과 {rows?.length ?? 0}명 기준입니다. 저장 전 변경을 포함하며 삭제 표시한 사원은 제외합니다. 전체 회사 통계가 아닙니다.</DialogDescription></DialogHeader>
      <div className="space-y-4 px-6 pb-6">
        <div className="flex flex-wrap gap-2">{([['group', '그룹과 소계'], ['pivot', '피벗'], ['chart', '차트']] as const).map(([value, text]) => <Button key={value} variant={mode === value ? "secondary" : "outline"} size="sm" aria-pressed={mode === value} onClick={() => setMode(value)}>{text}</Button>)}</div>
        <div className="flex gap-4"><label className="text-sm">분류 기준 <select aria-label="분류 기준" className="rounded border p-1" value={groupBy} onChange={(event) => setGroupBy(event.target.value as Dimension)}>{Object.entries(dimensions).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
          {mode === "pivot" && <label className="text-sm">열 기준 <select aria-label="피벗 열 기준" className="rounded border p-1" value={pivotBy} onChange={(event) => setPivotBy(event.target.value as Dimension)}>{Object.entries(dimensions).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>}</div>
        {!rows?.length && <p role="status">분석할 사원이 없습니다.</p>}
        {mode === "group" && groups.map(([name, items]) => <details key={name} className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{name} <span className="text-sm text-muted-foreground">소계 {items.length}명</span></summary><ul className="mt-3 space-y-2">{items.map((row) => <li key={row.id} className="flex justify-between gap-3 text-sm"><span>{row.employee_no || "신규"} / {row.display_name} / {row.position_title}</span><button className="text-primary underline" onClick={() => { onClose(); onDetail(row.id); }}>상세 보기</button></li>)}</ul></details>)}
        {mode === "pivot" && <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><caption className="pb-2 text-left">{dimensions[groupBy]} × {dimensions[pivotBy]} 인원</caption><thead><tr><th className="border p-2">{dimensions[groupBy]}</th>{pivotColumns.map((key) => <th className="border p-2" key={key}>{key}</th>)}<th className="border p-2">합계</th></tr></thead><tbody>{groups.map(([name, items]) => <tr key={name}><th className="border p-2 text-left">{name}</th>{pivotColumns.map((key) => <td className="border p-2 text-right" key={key}>{items.filter((row) => label(row, pivotBy) === key).length}</td>)}<td className="border p-2 text-right">{items.length}</td></tr>)}</tbody><tfoot><tr><th className="border p-2">합계</th>{pivotColumns.map((key) => <td className="border p-2 text-right" key={key}>{rows?.filter((row) => label(row, pivotBy) === key).length ?? 0}</td>)}<td className="border p-2 text-right">{rows?.length ?? 0}</td></tr></tfoot></table></div>}
        {mode === "chart" && <figure aria-label={`${dimensions[groupBy]}별 인원 차트`} className="space-y-3"><figcaption className="text-sm">{dimensions[groupBy]}별 인원 / 총 {rows?.length ?? 0}명</figcaption>{groups.map(([name, items]) => <div key={name} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm"><span className="truncate" title={name}>{name}</span><div className="h-5 rounded bg-primary/10"><div className="h-full rounded bg-primary" style={{ width: `${items.length / max * 100}%` }} /></div><span>{items.length}명</span></div>)}</figure>}
      </div>
    </DialogContent>
  </Dialog>;
}
