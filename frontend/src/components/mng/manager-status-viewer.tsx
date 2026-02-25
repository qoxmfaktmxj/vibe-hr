"use client";

import { useMemo, useState } from "react";
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
import type {
  MngCompanyDropdownResponse,
  MngManagerCompanyItem,
  MngManagerCompanyListResponse,
} from "@/types/mng";

type MappingForm = {
  employee_id: string;
  company_id: string;
  start_date: string;
  end_date: string;
  note: string;
};

const EMPTY_FORM: MappingForm = {
  employee_id: "",
  company_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  note: "",
};

export function ManagerStatusViewer() {
  const [form, setForm] = useState<MappingForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data, mutate } = useSWR<MngManagerCompanyListResponse>("/api/mng/manager-status", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: employeeData } = useSWR<{ employees?: EmployeeItem[] }>("/api/employees", fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];
  const companies = companyData?.companies ?? [];
  const employees = employeeData?.employees ?? [];
  const columnDefs = useMemo<ColDef<MngManagerCompanyItem>[]>(
    () => [
      { field: "employee_name", headerName: "담당자", width: 130 },
      { field: "company_name", headerName: "고객사", width: 170 },
      { field: "start_date", headerName: "시작일", width: 120 },
      { field: "end_date", headerName: "종료일", width: 120 },
      { field: "note", headerName: "비고", flex: 1 },
    ],
    [],
  );

  async function createMapping() {
    if (!form.employee_id || !form.company_id || !form.start_date) {
      toast.error("담당자, 고객사, 시작일은 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/mng/manager-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          company_id: Number(form.company_id),
          start_date: form.start_date,
          end_date: form.end_date || null,
          note: form.note || null,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "등록에 실패했습니다.");
      toast.success("등록되었습니다.");
      setForm(EMPTY_FORM);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMapping(item: MngManagerCompanyItem) {
    if (!confirm("선택한 매핑을 삭제할까요?")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/mng/manager-status", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "삭제에 실패했습니다.");
      toast.success("삭제되었습니다.");
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>담당자 배정 등록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={form.employee_id}
            onChange={(event) => setForm((prev) => ({ ...prev, employee_id: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">담당자 선택</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.display_name} ({employee.employee_no})
              </option>
            ))}
          </select>
          <select
            value={form.company_id}
            onChange={(event) => setForm((prev) => ({ ...prev, company_id: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">고객사 선택</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
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
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="비고"
          />
          <Button variant="save" onClick={() => void createMapping()} disabled={saving}>
            등록
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>담당자 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <MngSimpleGrid<MngManagerCompanyItem>
              rowData={items}
              columnDefs={columnDefs}
              height={360}
            />
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="outline"
                  onClick={() => void removeMapping(item)}
                  disabled={saving}
                >
                  {item.employee_name ?? "담당자"} 삭제
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
