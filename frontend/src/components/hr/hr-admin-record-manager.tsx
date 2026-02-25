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
};

type AdminGridRow = HrInfoRow & {
  employee_id: number;
  employee_no: string;
  display_name: string;
  department_name: string;
};

const EMPTY_FILTERS: SearchFilters = {
  employeeNo: "",
  name: "",
  department: "",
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
  return true;
}

export function HrAdminRecordManager({ category, title }: Props) {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AdminGridRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [addEmployeeId, setAddEmployeeId] = useState<number | null>(null);

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

  const employeeById = useMemo(() => {
    const map = new Map<number, EmployeeItem>();
    for (const employee of employees) map.set(employee.id, employee);
    return map;
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
    if (addEmployeeId == null) {
      setAddEmployeeId(employees[0].id);
    }
  }, [employees, addEmployeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addRow() {
    if (!addEmployeeId) return;
    const response = await fetch(`/api/hr/basic/${addEmployeeId}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title: newTitle || "신규", type: "", note: "" }),
    });
    if (!response.ok) return toast.error("추가 실패");
    setNewTitle("");
    toast.success("추가 완료");
    await refresh();
  }

  async function updateRow(row: AdminGridRow) {
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
    if (!response.ok) return toast.error("저장 실패");
    toast.success("저장 완료");
    await refresh();
  }

  async function deleteRow(row: AdminGridRow) {
    const response = await fetch(`/api/hr/basic/${row.employee_id}/records/${row.id}`, {
      method: "DELETE",
    });
    if (!response.ok) return toast.error("삭제 실패");
    toast.success("삭제 완료");
    await refresh();
  }

  const columns: ColDef<AdminGridRow>[] = [
    { field: "employee_no", headerName: "사번", editable: false, width: 120, pinned: "left" },
    { field: "display_name", headerName: "이름", editable: false, width: 120, pinned: "left" },
    { field: "department_name", headerName: "부서", editable: false, width: 140, pinned: "left" },
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

        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <Input
            value={searchFilters.employeeNo}
            onChange={(event) =>
              setSearchFilters((prev) => ({ ...prev, employeeNo: event.target.value }))
            }
            placeholder="사번"
          />
          <Input
            value={searchFilters.name}
            onChange={(event) =>
              setSearchFilters((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="이름"
          />
          <select
            value={searchFilters.department}
            onChange={(event) =>
              setSearchFilters((prev) => ({ ...prev, department: event.target.value }))
            }
            className="h-9 rounded-md border px-2 text-sm"
          >
            <option value="">전체 부서</option>
            {departmentOptions.map((departmentName) => (
              <option key={departmentName} value={departmentName}>
                {departmentName}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              onClick={() => setAppliedFilters(searchFilters)}
              disabled={loading}
            >
              조회
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchFilters(EMPTY_FILTERS);
                setAppliedFilters(EMPTY_FILTERS);
              }}
              disabled={loading}
            >
              초기화
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <select
            value={addEmployeeId ?? ""}
            onChange={(event) => setAddEmployeeId(Number(event.target.value))}
            className="h-9 rounded-md border px-2 text-sm"
          >
            {filteredEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employee_no} | {employee.display_name} | {employee.department_name}
              </option>
            ))}
          </select>
          <Input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="신규 제목"
            className="max-w-xs"
          />
          <Button onClick={addRow} disabled={!addEmployeeId}>
            행 추가
          </Button>
          <span className="text-xs text-slate-500">
            조회 대상: {filteredEmployees.length}명 / 레코드: {rows.length}건
          </span>
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
            void updateRow(event.data);
          }}
          onRowDoubleClicked={(event) => {
            if (!event.data) return;
            const employee = employeeById.get(event.data.employee_id);
            const target = `${employee?.employee_no ?? ""} ${employee?.display_name ?? ""}`.trim();
            if (confirm(`${target} 행을 삭제할까요?`)) {
              void deleteRow(event.data);
            }
          }}
        />
      </div>

      <p className="px-1 text-xs text-slate-500">
        관리자 통합 화면 · 다중 사원 조회 가능 · 체크박스 선택 없음 · 셀 수정 시 자동 저장 · 행 더블클릭 삭제
      </p>
    </div>
  );
}
