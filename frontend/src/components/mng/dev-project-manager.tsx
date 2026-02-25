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
import type {
  MngCompanyDropdownResponse,
  MngDevProjectItem,
  MngDevProjectListResponse,
} from "@/types/mng";

type ProjectForm = {
  id: number | null;
  project_name: string;
  company_id: string;
  assigned_staff: string;
  contract_start_date: string;
  contract_end_date: string;
  dev_start_date: string;
  dev_end_date: string;
  contract_amount: string;
  actual_man_months: string;
  inspection_status: string;
  has_tax_bill: boolean;
  note: string;
};

const EMPTY_FORM: ProjectForm = {
  id: null,
  project_name: "",
  company_id: "",
  assigned_staff: "",
  contract_start_date: "",
  contract_end_date: "",
  dev_start_date: "",
  dev_end_date: "",
  contract_amount: "",
  actual_man_months: "",
  inspection_status: "",
  has_tax_bill: false,
  note: "",
};

function toForm(item: MngDevProjectItem): ProjectForm {
  return {
    id: item.id,
    project_name: item.project_name,
    company_id: String(item.company_id),
    assigned_staff: item.assigned_staff ?? "",
    contract_start_date: item.contract_start_date ?? "",
    contract_end_date: item.contract_end_date ?? "",
    dev_start_date: item.dev_start_date ?? "",
    dev_end_date: item.dev_end_date ?? "",
    contract_amount: item.contract_amount?.toString() ?? "",
    actual_man_months: item.actual_man_months?.toString() ?? "",
    inspection_status: item.inspection_status ?? "",
    has_tax_bill: item.has_tax_bill,
    note: item.note ?? "",
  };
}

export function DevProjectManager() {
  const [companyFilter, setCompanyFilter] = useState("");
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const query = companyFilter ? `?company_id=${companyFilter}` : "";
  const { data, mutate } = useSWR<MngDevProjectListResponse>(`/api/mng/dev-projects${query}`, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];
  const companies = companyData?.companies ?? [];
  const columnDefs: ColDef<MngDevProjectItem>[] = [
    { field: "project_name", headerName: "프로젝트명", flex: 1, minWidth: 180 },
    { field: "company_name", headerName: "고객사", width: 160 },
    { field: "assigned_staff", headerName: "담당인력", width: 160 },
    {
      field: "contract_amount",
      headerName: "계약금액",
      width: 130,
      valueFormatter: (params) => (params.value ? Number(params.value).toLocaleString() : "-"),
    },
    { field: "actual_man_months", headerName: "실투입MM", width: 120 },
  ];

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function selectItem(item: MngDevProjectItem) {
    setForm(toForm(item));
  }

  async function saveItem() {
    if (!form.project_name.trim() || !form.company_id) {
      toast.error("프로젝트명/고객사는 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : null),
        project_name: form.project_name.trim(),
        company_id: Number(form.company_id),
        assigned_staff: form.assigned_staff || null,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        dev_start_date: form.dev_start_date || null,
        dev_end_date: form.dev_end_date || null,
        contract_amount: form.contract_amount ? Number(form.contract_amount) : null,
        actual_man_months: form.actual_man_months ? Number(form.actual_man_months) : null,
        inspection_status: form.inspection_status || null,
        has_tax_bill: form.has_tax_bill,
        note: form.note || null,
      };
      const response = await fetch("/api/mng/dev-projects", {
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
    if (!confirm("선택한 프로젝트를 삭제할까요?")) return;

    setSaving(true);
    try {
      const response = await fetch("/api/mng/dev-projects", {
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
          <CardTitle>프로젝트 목록</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">전체 고객사</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.company_name}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={resetForm}>
              신규
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MngSimpleGrid<MngDevProjectItem>
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
          <CardTitle>프로젝트 상세</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={form.project_name}
            onChange={(event) => setForm((prev) => ({ ...prev, project_name: event.target.value }))}
            placeholder="프로젝트명"
          />
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
          <Input
            value={form.assigned_staff}
            onChange={(event) => setForm((prev) => ({ ...prev, assigned_staff: event.target.value }))}
            placeholder="담당 인력"
          />
          <CustomDatePicker
            value={form.contract_start_date}
            onChange={(value) => setForm((prev) => ({ ...prev, contract_start_date: value }))}
            holidays={HOLIDAY_DATE_KEYS}
          />
          <CustomDatePicker
            value={form.contract_end_date}
            onChange={(value) => setForm((prev) => ({ ...prev, contract_end_date: value }))}
            holidays={HOLIDAY_DATE_KEYS}
          />
          <Input
            value={form.contract_amount}
            onChange={(event) => setForm((prev) => ({ ...prev, contract_amount: event.target.value }))}
            placeholder="계약 금액"
          />
          <Input
            value={form.actual_man_months}
            onChange={(event) => setForm((prev) => ({ ...prev, actual_man_months: event.target.value }))}
            placeholder="실투입 MM"
          />
          <Input
            value={form.inspection_status}
            onChange={(event) => setForm((prev) => ({ ...prev, inspection_status: event.target.value }))}
            placeholder="검수 상태"
          />
          <Input
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="비고"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.has_tax_bill}
              onChange={(event) => setForm((prev) => ({ ...prev, has_tax_bill: event.target.checked }))}
            />
            계산서 여부
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
