"use client";

import { useState } from "react";
import useSWR from "swr";
import type { ColDef } from "ag-grid-community";
import { BatchGridManager, type BatchGridRow } from "@/components/grid/batch-grid-manager";
import { fetcher } from "@/lib/fetcher";
import { getKoreaDateKey } from "@/lib/business-date";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { OrganizationDepartmentListResponse } from "@/types/organization";
import type { TimDepartmentScheduleAssignmentItem, TimSchedulePatternListResponse } from "@/types/tim";

type Item = TimDepartmentScheduleAssignmentItem;
const toItem = (row: Item) => ({ department_id: row.department_id, pattern_id: row.pattern_id, effective_from: row.effective_from, effective_to: row.effective_to || null, priority: row.priority, is_active: Boolean(row.is_active) });
function validate(row: Item) {
  if (!row.department_id || !row.pattern_id) return "조직과 근무패턴을 선택해 주세요.";
  if (!row.effective_from || (row.effective_to && row.effective_to < row.effective_from)) return "시작일과 종료일을 확인해 주세요.";
  return Number.isInteger(row.priority) ? null : "우선순위를 정수로 입력해 주세요.";
}
export function DepartmentScheduleAssignmentManager() {
  const { can, loading } = useMenuActions("/tim/work-codes");
  const enabled = !loading && can("query");
  const { data: patterns } = useSWR<TimSchedulePatternListResponse>(enabled ? "/api/tim/schedules/patterns" : null, fetcher, { revalidateOnFocus: false });
  const { data: departments } = useSWR<OrganizationDepartmentListResponse>(enabled ? "/api/org/departments?all=true" : null, fetcher, { revalidateOnFocus: false });
  const [departmentId, setDepartmentId] = useState("");
  const [patternId, setPatternId] = useState("");
  const options = patterns?.items ?? [];
  const label = (id: number) => options.find(item => item.id === id);
  const columns: ColDef<BatchGridRow<Item>>[] = [
    { field: "department_code", headerName: "조직코드", editable: false },
    { field: "department_name", headerName: "조직명", minWidth: 170, editable: false },
    { field: "organization_type", headerName: "조직구분", editable: false },
    { field: "cost_center_code", headerName: "코스트센터", editable: false },
    { field: "employee_count", headerName: "인원", width: 85, editable: false },
    { field: "pattern_id", headerName: "근무패턴", minWidth: 190, cellEditor: "agSelectCellEditor", cellEditorParams: { values: options.map(item => `${item.code} / ${item.name}`) }, valueFormatter: p => label(p.value) ? `${label(p.value)!.code} / ${label(p.value)!.name}` : String(p.data?.pattern_name ?? p.value ?? ""), valueParser: p => options.find(item => `${item.code} / ${item.name}` === p.newValue)?.id ?? p.oldValue },
    { field: "effective_from", headerName: "시작일", cellDataType: "dateString", cellEditor: "agDateStringCellEditor" },
    { field: "effective_to", headerName: "종료일", cellDataType: "dateString", cellEditor: "agDateStringCellEditor" },
    { field: "priority", headerName: "우선순위", cellDataType: "number" },
    { field: "is_active", headerName: "사용", cellDataType: "boolean" },
  ];
  return <BatchGridManager title="조직 기본 근무패턴" listUrl="/api/tim/schedules/departments" saveUrl="/api/tim/schedules/departments" columns={columns} toItem={toItem} validate={validate} canQuery={enabled} canSave={!loading && can("save")} createDisabled={!departments?.departments.some(item => item.id === Number(departmentId)) || !options.some(item => item.id === Number(patternId))} searchText={row => `${row.department_code} ${row.department_name} ${row.pattern_name ?? ""}`} searchPlaceholder="조직코드, 조직명, 근무패턴 검색" beforeGrid={<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">추가할 조직<select aria-label="추가할 조직" className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm" value={departmentId} disabled={!enabled} onChange={e => setDepartmentId(e.target.value)}><option value="">조직 선택</option>{departments?.departments.map(item => <option value={item.id} key={item.id}>{item.code} / {item.name} / {item.cost_center_code ?? "-"}</option>)}</select></label><label className="text-xs text-muted-foreground">추가할 근무패턴<select aria-label="조직 추가할 근무패턴" className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm" value={patternId} disabled={!enabled} onChange={e => setPatternId(e.target.value)}><option value="">패턴 선택</option>{options.map(item => <option value={item.id} key={item.id}>{item.code} / {item.name}</option>)}</select></label></div>} newRow={id => { const department = departments!.departments.find(item => item.id === Number(departmentId))!; const pattern = options.find(item => item.id === Number(patternId))!; return { id, department_id: department.id, department_code: department.code, department_name: department.name, organization_type: department.organization_type ?? null, cost_center_code: department.cost_center_code, employee_count: department.employee_count, pattern_id: pattern.id, pattern_code: pattern.code, pattern_name: pattern.name, effective_from: getKoreaDateKey(), effective_to: null, priority: 100, is_active: true }; }} />;
}
