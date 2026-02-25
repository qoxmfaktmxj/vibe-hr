"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { ColDef } from "ag-grid-community";

import { MngSimpleGrid } from "@/components/mng/mng-simple-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import type { EmployeeItem } from "@/types/employee";
import type { MngOutsourceContractItem, MngOutsourceContractListResponse } from "@/types/mng";

type ContractForm = {
  id: number | null;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_leave_count: string;
  extra_leave_count: string;
  note: string;
  is_active: boolean;
};

const EMPTY_FORM: ContractForm = {
  id: null,
  employee_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  total_leave_count: "0",
  extra_leave_count: "0",
  note: "",
  is_active: true,
};

function toForm(item: MngOutsourceContractItem): ContractForm {
  return {
    id: item.id,
    employee_id: String(item.employee_id),
    start_date: item.start_date,
    end_date: item.end_date,
    total_leave_count: String(item.total_leave_count),
    extra_leave_count: String(item.extra_leave_count),
    note: item.note ?? "",
    is_active: item.is_active,
  };
}

export function OutsourceContractManager() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [form, setForm] = useState<ContractForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const query = appliedSearch ? `?search=${encodeURIComponent(appliedSearch)}` : "";
  const { data, mutate } = useSWR<MngOutsourceContractListResponse>(`/api/mng/outsource-contracts${query}`, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: employeeData } = useSWR<{ employees?: EmployeeItem[] }>("/api/employees", fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];
  const employees = employeeData?.employees ?? [];
  const columnDefs: ColDef<MngOutsourceContractItem>[] = [
    { field: "employee_name", headerName: "사원", width: 130 },
    { field: "employee_no", headerName: "사번", width: 120 },
    { field: "start_date", headerName: "시작일", width: 120 },
    { field: "end_date", headerName: "종료일", width: 120 },
    {
      headerName: "총연차",
      width: 110,
      valueGetter: (params) =>
        Number(params.data?.total_leave_count ?? 0) + Number(params.data?.extra_leave_count ?? 0),
    },
  ];

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function selectItem(item: MngOutsourceContractItem) {
    setForm(toForm(item));
  }

  async function validateDuplicate() {
    const employeeId = Number(form.employee_id);
    if (!employeeId || !form.start_date) return false;
    const response = await fetch(
      `/api/mng/outsource-contracts/check-duplicate?employee_id=${employeeId}&start_date=${form.start_date}${form.id ? `&exclude_contract_id=${form.id}` : ""}`,
      { cache: "no-store" },
    );
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(json?.detail ?? "중복 체크에 실패했습니다.");
    }
    return Boolean(json?.is_duplicate);
  }

  async function saveItem() {
    if (!form.employee_id || !form.start_date || !form.end_date) {
      toast.error("사원/시작일/종료일은 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const isDuplicate = await validateDuplicate();
      if (isDuplicate) {
        toast.error("동일한 사원/시작일 계약이 이미 존재합니다.");
        return;
      }

      const payload = {
        ...(form.id ? { id: form.id } : null),
        employee_id: Number(form.employee_id),
        start_date: form.start_date,
        end_date: form.end_date,
        total_leave_count: Number(form.total_leave_count || 0),
        extra_leave_count: Number(form.extra_leave_count || 0),
        note: form.note || null,
        is_active: form.is_active,
      };
      const response = await fetch("/api/mng/outsource-contracts", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "저장에 실패했습니다.");
      toast.success("저장되었습니다.");
      await mutate();
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!form.id) return;
    if (!confirm("선택한 계약을 삭제할까요?")) return;

    setSaving(true);
    try {
      const response = await fetch("/api/mng/outsource-contracts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [form.id] }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "삭제에 실패했습니다.");
      toast.success("삭제되었습니다.");
      await mutate();
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>외주 계약 목록</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setAppliedSearch(search.trim());
              }}
              placeholder="사번/이름 검색"
              className="h-9"
            />
            <Button variant="query" onClick={() => setAppliedSearch(search.trim())}>
              조회
            </Button>
            <Button variant="outline" onClick={resetForm}>
              신규
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MngSimpleGrid<MngOutsourceContractItem>
            rowData={items}
            columnDefs={columnDefs}
            onRowClick={selectItem}
            getRowId={(row) => String(row.id)}
            selectedRowId={form.id ? String(form.id) : null}
            height={340}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>외주 계약 상세</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={form.employee_id}
            onChange={(event) => setForm((prev) => ({ ...prev, employee_id: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">사원 선택</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.display_name} ({employee.employee_no})
              </option>
            ))}
          </select>
          <CustomDatePicker
            value={form.start_date}
            onChange={(value) => setForm((prev) => ({ ...prev, start_date: value }))}
            holidays={HOLIDAY_DATE_KEYS}
          />
          <CustomDatePicker
            value={form.end_date}
            onChange={(value) => setForm((prev) => ({ ...prev, end_date: value }))}
            holidays={HOLIDAY_DATE_KEYS}
          />
          <Input
            value={form.total_leave_count}
            onChange={(event) => setForm((prev) => ({ ...prev, total_leave_count: event.target.value }))}
            placeholder="생성 연차 개수"
          />
          <Input
            value={form.extra_leave_count}
            onChange={(event) => setForm((prev) => ({ ...prev, extra_leave_count: event.target.value }))}
            placeholder="추가 연차 개수"
          />
          <Input
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="비고"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            사용 여부
          </label>
          <div className="flex gap-2">
            <Button variant="save" onClick={() => void saveItem()} disabled={saving}>
              저장
            </Button>
            <Button variant="destructive" onClick={() => void deleteItem()} disabled={saving || !form.id}>
              삭제
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
