"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { ColDef } from "ag-grid-community";
import { BatchGridManager, type BatchGridRow } from "@/components/grid/batch-grid-manager";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import { getKoreaDateKey } from "@/lib/business-date";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { EmployeeItem, EmployeeListResponse } from "@/types/employee";
import type { TimEmployeeScheduleExceptionItem, TimSchedulePatternListResponse } from "@/types/tim";

type Item = TimEmployeeScheduleExceptionItem;
const toItem = (row: Item) => ({ employee_id: row.employee_id, pattern_id: row.pattern_id, effective_from: row.effective_from, effective_to: row.effective_to || null, priority: row.priority, reason: row.reason?.trim() || null, is_active: Boolean(row.is_active) });
function validate(row: Item) {
  if (!row.employee_id || !row.pattern_id) return "사원과 근무패턴을 선택해 주세요.";
  if (!row.effective_from || (row.effective_to && row.effective_to < row.effective_from)) return "시작일과 종료일을 확인해 주세요.";
  return Number.isInteger(row.priority) ? null : "우선순위를 정수로 입력해 주세요.";
}
export function EmployeeScheduleExceptionManager() {
  const { can, loading } = useMenuActions("/tim/work-codes");
  const enabled = !loading && can("query");
  const { data: patterns } = useSWR<TimSchedulePatternListResponse>(enabled ? "/api/tim/schedules/patterns" : null, fetcher, { revalidateOnFocus: false });
  const [employee, setEmployee] = useState<EmployeeItem | null>(null);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [patternId, setPatternId] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(employeeQuery.trim()), 250); return () => clearTimeout(timer); }, [employeeQuery]);
  const { data: results, error: lookupError } = useSWR<EmployeeItem[]>(enabled && debounced && debounced === employeeQuery.trim() ? ["schedule-employee", debounced] : null, async ([, query]: string[]) => {
    const responses = await Promise.all(["name", "employee_no"].map(key => fetcher<EmployeeListResponse>(`/api/employees?page=1&limit=8&${key}=${encodeURIComponent(query)}`)));
    return [...new Map(responses.flatMap(response => response.employees).map(item => [item.id, item])).values()].slice(0, 8);
  }, { revalidateOnFocus: false });
  const options = patterns?.items ?? [];
  const patternLabel = (id: number) => options.find(item => item.id === id);
  const columns: ColDef<BatchGridRow<Item>>[] = [
    { field: "employee_no", headerName: "사번", editable: false },
    { field: "employee_name", headerName: "이름", editable: false },
    { field: "department_name", headerName: "조직", editable: false },
    { field: "pattern_id", headerName: "예외 근무패턴", minWidth: 190, cellEditor: "agSelectCellEditor", cellEditorParams: { values: options.map(item => `${item.code} / ${item.name}`) }, valueFormatter: p => patternLabel(p.value) ? `${patternLabel(p.value)!.code} / ${patternLabel(p.value)!.name}` : String(p.data?.pattern_name ?? p.value ?? ""), valueParser: p => options.find(item => `${item.code} / ${item.name}` === p.newValue)?.id ?? p.oldValue },
    { field: "effective_from", headerName: "시작일", cellDataType: "dateString", cellEditor: "agDateStringCellEditor" },
    { field: "effective_to", headerName: "종료일", cellDataType: "dateString", cellEditor: "agDateStringCellEditor" },
    { field: "reason", headerName: "사유", minWidth: 180, flex: 1 },
    { field: "priority", headerName: "우선순위", cellDataType: "number" },
    { field: "is_active", headerName: "사용", cellDataType: "boolean" },
  ];
  return <BatchGridManager title="개인 예외 근무조" listUrl="/api/tim/schedules/exceptions/employees" saveUrl="/api/tim/schedules/exceptions/employees" columns={columns} toItem={toItem} validate={validate} canQuery={enabled} canSave={!loading && can("save")} createDisabled={!employee || !options.some(item => item.id === Number(patternId))} searchText={row => `${row.employee_no ?? ""} ${row.employee_name ?? ""} ${row.department_name ?? ""} ${row.reason ?? ""}`} searchPlaceholder="사번, 이름, 조직, 사유 검색" beforeGrid={<div className="grid items-start gap-3 sm:grid-cols-2"><div><label className="text-xs text-muted-foreground">추가할 사원<Input aria-label="추가할 사원 검색" placeholder="사번 또는 이름 검색" value={employeeQuery} disabled={!enabled} onChange={e => { setEmployeeQuery(e.target.value); setEmployee(null); }} className="mt-1 h-9" /></label>{employee && <p className="mt-2 text-xs font-semibold text-primary">{employee.employee_no} / {employee.display_name} / {employee.department_name}</p>}{!employee && employeeQuery.trim() === debounced && results && <div className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-card">{results.map(item => <button type="button" key={item.id} className="block w-full px-3 py-2 text-left text-xs hover:bg-accent" onClick={() => { setEmployee(item); setEmployeeQuery(""); }}>{item.employee_no} / {item.display_name} / {item.department_name}</button>)}{results.length === 0 && <p className="p-2 text-xs text-muted-foreground">일치하는 사원이 없습니다.</p>}</div>}{lookupError && <p role="alert" className="text-xs text-destructive">사원 검색에 실패했습니다.</p>}</div><label className="text-xs text-muted-foreground">추가할 근무패턴<select aria-label="개인 추가할 근무패턴" className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm" value={patternId} disabled={!enabled} onChange={e => setPatternId(e.target.value)}><option value="">패턴 선택</option>{options.map(item => <option value={item.id} key={item.id}>{item.code} / {item.name}</option>)}</select></label></div>} newRow={id => { const pattern = options.find(item => item.id === Number(patternId))!; return { id, employee_id: employee!.id, employee_no: employee!.employee_no, employee_name: employee!.display_name, department_id: employee!.department_id, department_code: null, department_name: employee!.department_name, pattern_id: pattern.id, pattern_code: pattern.code, pattern_name: pattern.name, effective_from: getKoreaDateKey(), effective_to: null, reason: null, priority: 1000, is_active: true }; }} />;
}
