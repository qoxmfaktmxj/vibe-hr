"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleRegistry, AllCommunityModule, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { toast } from "sonner";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { EmployeeItem } from "@/types/employee";
import type { HrBasicDetailResponse, HrInfoRow } from "@/types/hr-employee-profile";

let registered = false;
if (!registered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  registered = true;
}

type Props = {
  category:
    | "appointment"
    | "reward_penalty"
    | "contact"
    | "education"
    | "career"
    | "certificate"
    | "military"
    | "evaluation";
  title: string;
};

type SearchFilters = {
  employeeNo: string;
  name: string;
  department: string;
  employmentStatus: "" | "active" | "leave" | "resigned";
};

type AdminGridRow = HrInfoRow & {
  employee_id: number;
  employee_no: string;
  display_name: string;
  department_name: string;
  employment_status: EmployeeItem["employment_status"];
  delete_mark?: boolean;
  _dirty?: boolean;
  _original?: Pick<HrInfoRow, "record_date" | "type" | "title" | "organization" | "value" | "note">;
};

const EMPTY_FILTERS: SearchFilters = {
  employeeNo: "",
  name: "",
  department: "",
  employmentStatus: "",
};

function pickRows(detail: HrBasicDetailResponse | null, category: Props["category"]): HrInfoRow[] {
  if (!detail) return [];
  switch (category) {
    case "appointment":
      return detail.appointments;
    case "reward_penalty":
      return detail.rewards_penalties;
    case "contact":
      return detail.contacts;
    case "education":
      return detail.educations;
    case "career":
      return detail.careers;
    case "certificate":
      return detail.certificates;
    case "military":
      return detail.military;
    default:
      return detail.evaluations;
  }
}

function matches(employee: EmployeeItem, filters: SearchFilters): boolean {
  const employeeNo = filters.employeeNo.trim().toLowerCase();
  const name = filters.name.trim().toLowerCase();
  const department = filters.department.trim().toLowerCase();

  if (employeeNo && !employee.employee_no.toLowerCase().includes(employeeNo)) return false;
  if (name && !employee.display_name.toLowerCase().includes(name)) return false;
  if (department && !(employee.department_name ?? "").toLowerCase().includes(department)) return false;
  if (filters.employmentStatus && employee.employment_status !== filters.employmentStatus) return false;
  return true;
}

export function HrAdminRecordManager({ category, title }: Props) {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AdminGridRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: employeeData } = useSWR<{ employees?: EmployeeItem[] }>("/api/employees", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const employees = useMemo(() => employeeData?.employees ?? [], [employeeData?.employees]);

  const filteredEmployees = useMemo(
    () => employees.filter((employee) => matches(employee, appliedFilters)),
    [employees, appliedFilters],
  );

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const employee of employees) {
      if (employee.department_name) set.add(employee.department_name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [employees]);

  const refresh = useCallback(async () => {
    if (filteredEmployees.length === 0) {
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      const detailResults = await Promise.all(
        filteredEmployees.map(async (employee) => {
          const response = await fetch(`/api/hr/basic/${employee.id}`, { cache: "no-store" });
          if (!response.ok) throw new Error(`${employee.employee_no} 조회 실패`);
          const detail = (await response.json()) as HrBasicDetailResponse;
          return { employee, detail };
        }),
      );

      const mergedRows: AdminGridRow[] = [];
      for (const { employee, detail } of detailResults) {
        const records = pickRows(detail, category);
        for (const record of records) {
          mergedRows.push({
            ...record,
            employee_id: employee.id,
            employee_no: employee.employee_no,
            display_name: employee.display_name,
            department_name: employee.department_name,
            employment_status: employee.employment_status,
            delete_mark: false,
            _dirty: false,
            _original: {
              record_date: record.record_date,
              type: record.type,
              title: record.title,
              organization: record.organization,
              value: record.value,
              note: record.note,
            },
          });
        }
      }

      mergedRows.sort((a, b) => {
        if (a.employee_no !== b.employee_no) return a.employee_no.localeCompare(b.employee_no);
        return (b.record_date ?? "").localeCompare(a.record_date ?? "");
      });

      setRows(mergedRows);
    } catch (error) {
      console.error(error);
      toast.error("데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [filteredEmployees, category]);

  useEffect(() => {
    if (employees.length === 0) return;
    void refresh();
  }, [employees.length, refresh]);

  const saveAll = useCallback(async () => {
    setSaving(true);
    try {
      const toDelete = rows.filter((row) => row.delete_mark);
      const toUpdate = rows.filter((row) => !row.delete_mark && row._dirty);

      for (const row of toDelete) {
        const response = await fetch(`/api/hr/basic/${row.employee_id}/records/${row.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(`${row.employee_no} 삭제 실패`);
      }

      for (const row of toUpdate) {
        const response = await fetch(`/api/hr/basic/${row.employee_id}/records/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            record_date: row.record_date || null,
            type: row.type || null,
            title: row.title || null,
            organization: row.organization || null,
            value: row.value || null,
            note: row.note || null,
          }),
        });
        if (!response.ok) throw new Error(`${row.employee_no} 저장 실패`);
      }

      toast.success(`저장 완료 (삭제 ${toDelete.length}건 / 수정 ${toUpdate.length}건)`);
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [rows, refresh]);

  const columns: ColDef<AdminGridRow>[] = [
    { field: "delete_mark", headerName: "삭제", editable: true, width: 72, cellDataType: "boolean" },
    {
      field: "_dirty",
      headerName: "상태",
      width: 90,
      editable: false,
      valueGetter: (params) => (params.data?.delete_mark ? "삭제" : params.data?._dirty ? "수정" : ""),
    },
    { field: "employee_no", headerName: "사번", editable: false, width: 120, pinned: "left" },
    { field: "display_name", headerName: "이름", editable: false, width: 120, pinned: "left" },
    { field: "department_name", headerName: "부서", editable: false, width: 140, pinned: "left" },
    {
      field: "employment_status",
      headerName: "재직상태",
      editable: false,
      width: 100,
      valueFormatter: (p) => (p.value === "leave" ? "휴직" : p.value === "resigned" ? "퇴직" : "재직"),
    },
    { field: "record_date", headerName: "일자", editable: true, flex: 1, minWidth: 120 },
    { field: "type", headerName: "구분", editable: true, flex: 1, minWidth: 120 },
    { field: "title", headerName: "제목", editable: true, flex: 1.2, minWidth: 140 },
    { field: "organization", headerName: "기관/부서", editable: true, flex: 1.2, minWidth: 140 },
    { field: "value", headerName: "값", editable: true, flex: 1, minWidth: 140 },
    { field: "note", headerName: "비고", editable: true, flex: 1.5, minWidth: 180 },
  ];

  return (
    <div className="space-y-3 p-4 lg:p-6">
      <div className="rounded-lg border bg-white p-3">
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>

        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          <Input
            value={searchFilters.employeeNo}
            onChange={(event) => setSearchFilters((prev) => ({ ...prev, employeeNo: event.target.value }))}
            placeholder="사번"
          />
          <Input
            value={searchFilters.name}
            onChange={(event) => setSearchFilters((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="이름"
          />
          <select
            value={searchFilters.department}
            onChange={(event) => setSearchFilters((prev) => ({ ...prev, department: event.target.value }))}
            className="h-9 rounded-md border px-2 text-sm"
          >
            <option value="">전체 부서</option>
            {departmentOptions.map((departmentName) => (
              <option key={departmentName} value={departmentName}>
                {departmentName}
              </option>
            ))}
          </select>
          <select
            value={searchFilters.employmentStatus}
            onChange={(event) =>
              setSearchFilters((prev) => ({ ...prev, employmentStatus: event.target.value as SearchFilters["employmentStatus"] }))
            }
            className="h-9 rounded-md border px-2 text-sm"
          >
            <option value="">전체 재직상태</option>
            <option value="active">재직</option>
            <option value="leave">휴직</option>
            <option value="resigned">퇴직</option>
          </select>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setAppliedFilters(searchFilters)} disabled={loading || saving}>조회</Button>
            <Button variant="save" onClick={() => void saveAll()} disabled={loading || saving}>저장</Button>
          </div>
        </div>

        <div className="flex items-center border-t pt-3 text-xs text-slate-500">
          조회 대상: {filteredEmployees.length}명 / 레코드: {rows.length}건
        </div>
      </div>

      <div className="ag-theme-quartz" style={{ height: 620 }}>
        <AgGridReact<AdminGridRow>
          rowData={rows}
          columnDefs={columns}
          getRowId={(params) => `${params.data.employee_id}-${params.data.id}`}
          rowSelection={{ mode: "singleRow", checkboxes: false }}
          suppressRowClickSelection
          onCellValueChanged={(event) => {
            if (!event.data) return;
            const current = event.data;
            const original = current._original;
            const dirty =
              !!original &&
              (original.record_date !== current.record_date ||
                original.type !== current.type ||
                original.title !== current.title ||
                original.organization !== current.organization ||
                original.value !== current.value ||
                original.note !== current.note);

            setRows((prev) =>
              prev.map((row) =>
                row.employee_id === current.employee_id && row.id === current.id
                  ? { ...current, _dirty: dirty }
                  : row,
              ),
            );
          }}
        />
      </div>

      <p className="px-1 text-xs text-slate-500">
        관리자 통합 화면 · 전체 인원 조회 · 삭제 체크 후 저장 시 삭제 · 체크박스 선택 없음
      </p>
    </div>
  );
}
