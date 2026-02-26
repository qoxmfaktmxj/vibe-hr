"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { toast } from "sonner";
import { Copy, Plus, Save, Search } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { EmployeeItem } from "@/types/employee";
import type { HrInfoRow } from "@/types/hr-employee-profile";

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

type RowStatus = "clean" | "added" | "updated" | "deleted";

type AdminGridRow = HrInfoRow & {
  employee_id: number;
  employee_no: string;
  display_name: string;
  department_name: string;
  employment_status: EmployeeItem["employment_status"];
  _status: RowStatus;
  _tempId?: number;
  _original?: Pick<HrInfoRow, "record_date" | "type" | "title" | "organization" | "value" | "note">;
};

const EMPTY_FILTERS: SearchFilters = {
  employeeNo: "",
  name: "",
  department: "",
  employmentStatus: "",
};

const STATUS_LABEL: Record<RowStatus, string> = {
  clean: "",
  added: "입력",
  updated: "수정",
  deleted: "삭제",
};

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

function sameAsOriginal(row: AdminGridRow): boolean {
  const original = row._original;
  if (!original) return false;
  return (
    (row.record_date ?? null) === (original.record_date ?? null) &&
    (row.type ?? null) === (original.type ?? null) &&
    (row.title ?? null) === (original.title ?? null) &&
    (row.organization ?? null) === (original.organization ?? null) &&
    (row.value ?? null) === (original.value ?? null) &&
    (row.note ?? null) === (original.note ?? null)
  );
}

export function HrAdminRecordManager({ category, title }: Props) {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AdminGridRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempId, setTempId] = useState(-1);
  const [gridApi, setGridApi] = useState<GridApi<AdminGridRow> | null>(null);

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

  const refresh = useCallback(async (targetFilters?: SearchFilters) => {
    const filters = targetFilters ?? appliedFilters;

    setLoading(true);
    try {
      const params = new URLSearchParams({ category });
      if (filters.employeeNo.trim()) params.set("employee_no", filters.employeeNo.trim());
      if (filters.name.trim()) params.set("name", filters.name.trim());
      if (filters.department.trim()) params.set("department", filters.department.trim());
      if (filters.employmentStatus) params.set("employment_status", filters.employmentStatus);

      const response = await fetch(`/api/hr/basic/admin-records?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("조회 실패");

      const data = (await response.json()) as { items?: AdminGridRow[] };
      const mergedRows = (data.items ?? []).map((row) => ({
        ...row,
        _status: "clean" as RowStatus,
        _original: {
          record_date: row.record_date,
          type: row.type,
          title: row.title,
          organization: row.organization,
          value: row.value,
          note: row.note,
        },
      }));

      setRows(mergedRows);
    } catch (error) {
      console.error(error);
      toast.error("데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, category]);

  const handleQuery = useCallback(async () => {
    const nextApplied = { ...searchFilters };
    setAppliedFilters(nextApplied);
    await refresh(nextApplied);
  }, [refresh, searchFilters]);

  const addRow = useCallback(() => {
    const selected = gridApi?.getSelectedRows() ?? [];
    const base = selected[0];
    if (!base) {
      toast.error("입력할 기준 행(직원)을 먼저 선택해 주세요.");
      return;
    }

    const nextTempId = tempId;
    setTempId((prev) => prev - 1);

    const newRow: AdminGridRow = {
      id: nextTempId,
      category,
      employee_id: base.employee_id,
      employee_no: base.employee_no,
      display_name: base.display_name,
      department_name: base.department_name,
      employment_status: base.employment_status,
      record_date: new Date().toISOString().slice(0, 10),
      type: "",
      title: "",
      organization: "",
      value: "",
      note: "",
      created_at: new Date().toISOString(),
      _status: "added",
      _tempId: nextTempId,
    };

    setRows((prev) => [newRow, ...prev]);
  }, [category, gridApi, tempId]);

  const copyRow = useCallback(() => {
    const selected = gridApi?.getSelectedRows() ?? [];
    if (selected.length === 0) {
      toast.error("복사할 행을 선택해 주세요.");
      return;
    }

    const clones: AdminGridRow[] = [];
    let cursor = tempId;
    for (const row of selected) {
      cursor -= 1;
      clones.push({
        ...row,
        id: cursor,
        created_at: new Date().toISOString(),
        _status: "added",
        _tempId: cursor,
        _original: undefined,
      });
    }
    setTempId(cursor);
    setRows((prev) => [...clones, ...prev]);
  }, [gridApi, tempId]);

  useEffect(() => {
    void refresh(appliedFilters);
  }, [appliedFilters, refresh]);

  const toggleDeleteSelected = useCallback(() => {
    const selected = gridApi?.getSelectedRows() ?? [];
    if (selected.length === 0) {
      toast.error("삭제할 행을 선택해 주세요.");
      return;
    }

    const selectedKey = new Set(selected.map((row) => `${row.employee_id}-${row.id}`));
    setRows((prev) =>
      prev
        .map((row) => {
          const key = `${row.employee_id}-${row.id}`;
          if (!selectedKey.has(key)) return row;
          if (row._status === "added") return null;
          return { ...row, _status: row._status === "deleted" ? "clean" : "deleted" };
        })
        .filter((row): row is AdminGridRow => row !== null),
    );
  }, [gridApi]);

  const saveAll = useCallback(async () => {
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated" && row.id > 0);

    if (toDelete.length + toInsert.length + toUpdate.length === 0) {
      toast.info("변경된 데이터가 없습니다.");
      return;
    }

    setSaving(true);
    try {
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
        if (!response.ok) throw new Error(`${row.employee_no} 수정 실패`);
      }

      for (const row of toInsert) {
        const response = await fetch(`/api/hr/basic/${row.employee_id}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            record_date: row.record_date || null,
            type: row.type || null,
            title: row.title || null,
            organization: row.organization || null,
            value: row.value || null,
            note: row.note || null,
          }),
        });
        if (!response.ok) throw new Error(`${row.employee_no} 입력 실패`);
      }

      toast.success(`저장 완료 (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`);
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [category, refresh, rows]);

  const columns: ColDef<AdminGridRow>[] = [
    {
      field: "_status",
      headerName: "상태",
      width: 80,
      editable: false,
      valueFormatter: (params) => STATUS_LABEL[(params.value as RowStatus) ?? "clean"],
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
    {
      field: "record_date",
      headerName: "일자",
      editable: (params) => params.data?._status !== "deleted",
      flex: 1,
      minWidth: 120,
    },
    {
      field: "type",
      headerName: "구분",
      editable: (params) => params.data?._status !== "deleted",
      flex: 1,
      minWidth: 120,
    },
    {
      field: "title",
      headerName: "제목",
      editable: (params) => params.data?._status !== "deleted",
      flex: 1.2,
      minWidth: 140,
    },
    {
      field: "organization",
      headerName: "기관/부서",
      editable: (params) => params.data?._status !== "deleted",
      flex: 1.2,
      minWidth: 140,
    },
    {
      field: "value",
      headerName: "값",
      editable: (params) => params.data?._status !== "deleted",
      flex: 1,
      minWidth: 140,
    },
    {
      field: "note",
      headerName: "비고",
      editable: (params) => params.data?._status !== "deleted",
      flex: 1.5,
      minWidth: 180,
    },
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
            <Button variant="query" onClick={() => void handleQuery()} disabled={loading || saving}>
              <Search className="h-3.5 w-3.5" />조회
            </Button>
          </div>
        </div>

        <div className="flex items-center border-t pt-3 text-xs text-slate-500">
          조회 대상: {filteredEmployees.length}명 / 레코드: {rows.length}건
        </div>
      </div>

      <div className="rounded-lg border bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={addRow} disabled={loading || saving}>
              <Plus className="h-3.5 w-3.5" />입력
            </Button>
            <Button variant="outline" onClick={copyRow} disabled={loading || saving}>
              <Copy className="h-3.5 w-3.5" />복사
            </Button>
            <Button variant="outline" onClick={toggleDeleteSelected} disabled={loading || saving}>
              삭제
            </Button>
            <Button variant="save" onClick={() => void saveAll()} disabled={loading || saving}>
              <Save className="h-3.5 w-3.5" />저장
            </Button>
          </div>
        </div>

        <div className="ag-theme-quartz" style={{ height: 620 }}>
          <AgGridReact<AdminGridRow>
            rowData={rows}
            columnDefs={columns}
            getRowId={(params) => `${params.data.employee_id}-${params.data.id}`}
            rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: false }}
            suppressRowClickSelection
            singleClickEdit
            onGridReady={(event: GridReadyEvent<AdminGridRow>) => setGridApi(event.api)}
            onCellValueChanged={(event) => {
              if (!event.data) return;
              const current = event.data;

              setRows((prev) =>
                prev.map((row) => {
                  if (row.employee_id !== current.employee_id || row.id !== current.id) return row;
                  if (row._status === "added") return { ...current, _status: "added" };
                  const nextStatus = sameAsOriginal(current) ? "clean" : "updated";
                  return { ...current, _status: nextStatus };
                }),
              );
            }}
            getRowStyle={(params) => {
              if (params.data?._status === "deleted") return { backgroundColor: "#fef2f2", opacity: 0.75 };
              return undefined;
            }}
          />
        </div>
      </div>

      <p className="px-1 text-xs text-slate-500">입력/복사/삭제 후 저장 시 일괄 반영됩니다.</p>
    </div>
  );
}
