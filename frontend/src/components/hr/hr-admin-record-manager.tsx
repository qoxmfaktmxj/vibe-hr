"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleRegistry, AllCommunityModule, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";

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
  category: "appointment" | "reward_penalty" | "contact" | "education" | "career" | "certificate" | "military" | "evaluation";
  title: string;
};

function pickRows(detail: HrBasicDetailResponse | null, category: Props["category"]): HrInfoRow[] {
  if (!detail) return [];
  switch (category) {
    case "appointment": return detail.appointments;
    case "reward_penalty": return detail.rewards_penalties;
    case "contact": return detail.contacts;
    case "education": return detail.educations;
    case "career": return detail.careers;
    case "certificate": return detail.certificates;
    case "military": return detail.military;
    default: return detail.evaluations;
  }
}

export function HrAdminRecordManager({ category, title }: Props) {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const { data: employeeData } = useSWR<{ employees?: EmployeeItem[] }>("/api/employees", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const employees = employeeData?.employees ?? [];

  useEffect(() => {
    if (!employeeId && employees.length > 0) setEmployeeId(employees[0].id);
  }, [employeeId, employees]);

  const detailKey = employeeId ? `/api/hr/basic/${employeeId}` : null;
  const { data: detail } = useSWR<HrBasicDetailResponse>(detailKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });

  const rows = useMemo(() => pickRows(detail ?? null, category), [detail, category]);

  const columns: ColDef<HrInfoRow>[] = [
    { field: "record_date", headerName: "일자", editable: true, flex: 1, minWidth: 120 },
    { field: "type", headerName: "구분", editable: true, flex: 1, minWidth: 120 },
    { field: "title", headerName: "제목", editable: true, flex: 1, minWidth: 140 },
    { field: "organization", headerName: "기관/부서", editable: true, flex: 1, minWidth: 140 },
    { field: "value", headerName: "값", editable: true, flex: 1, minWidth: 140 },
    { field: "note", headerName: "비고", editable: true, flex: 1, minWidth: 160 },
  ];

  async function refresh() {
    if (!detailKey) return;
    await mutate(detailKey);
  }

  async function addRow() {
    if (!employeeId) return;
    const response = await fetch(`/api/hr/basic/${employeeId}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title: newTitle || "신규", type: "", note: "" }),
    });
    if (!response.ok) return toast.error("추가 실패");
    setNewTitle("");
    toast.success("추가 완료");
    await refresh();
  }

  async function updateRow(row: HrInfoRow) {
    if (!employeeId) return;
    const response = await fetch(`/api/hr/basic/${employeeId}/records/${row.id}`, {
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

  async function deleteRow(row: HrInfoRow) {
    if (!employeeId) return;
    const response = await fetch(`/api/hr/basic/${employeeId}/records/${row.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("삭제 실패");
    toast.success("삭제 완료");
    await refresh();
  }

  return (
    <div className="space-y-3 p-4 lg:p-6">
      <div className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <select value={employeeId ?? ""} onChange={(e) => setEmployeeId(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.employee_no} | {employee.display_name}</option>
            ))}
          </select>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="신규 제목" className="max-w-xs" />
          <Button onClick={addRow}>행 추가</Button>
        </div>
      </div>

      <div className="ag-theme-quartz" style={{ height: 560 }}>
        <AgGridReact<HrInfoRow>
          rowData={rows}
          columnDefs={columns}
          getRowId={(params) => String(params.data.id)}
          rowSelection={{ mode: "singleRow" }}
          onCellValueChanged={(event) => {
            if (!event.data) return;
            void updateRow(event.data);
          }}
          onRowDoubleClicked={(event) => {
            if (!event.data) return;
            if (confirm("이 행을 삭제할까요?")) void deleteRow(event.data);
          }}
        />
      </div>
      <p className="px-1 text-xs text-slate-500">관리자 전용 화면 · 셀 수정 시 자동 저장 · 행 더블클릭 삭제</p>
    </div>
  );
}
