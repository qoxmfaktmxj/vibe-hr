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
  MngDevInquiryItem,
  MngDevInquiryListResponse,
} from "@/types/mng";

type InquiryForm = {
  id: number | null;
  company_id: string;
  inquiry_content: string;
  hoped_start_date: string;
  estimated_man_months: string;
  sales_rep_name: string;
  client_contact_name: string;
  progress_code: string;
  project_name: string;
  note: string;
  is_confirmed: boolean;
};

const EMPTY_FORM: InquiryForm = {
  id: null,
  company_id: "",
  inquiry_content: "",
  hoped_start_date: "",
  estimated_man_months: "",
  sales_rep_name: "",
  client_contact_name: "",
  progress_code: "",
  project_name: "",
  note: "",
  is_confirmed: false,
};

function toForm(item: MngDevInquiryItem): InquiryForm {
  return {
    id: item.id,
    company_id: String(item.company_id),
    inquiry_content: item.inquiry_content ?? "",
    hoped_start_date: item.hoped_start_date ?? "",
    estimated_man_months: item.estimated_man_months?.toString() ?? "",
    sales_rep_name: item.sales_rep_name ?? "",
    client_contact_name: item.client_contact_name ?? "",
    progress_code: item.progress_code ?? "",
    project_name: item.project_name ?? "",
    note: item.note ?? "",
    is_confirmed: item.is_confirmed,
  };
}

export function DevInquiryManager() {
  const [companyFilter, setCompanyFilter] = useState("");
  const [form, setForm] = useState<InquiryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const query = companyFilter ? `?company_id=${companyFilter}` : "";
  const { data, mutate } = useSWR<MngDevInquiryListResponse>(`/api/mng/dev-inquiries${query}`, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];
  const companies = companyData?.companies ?? [];
  const columnDefs: ColDef<MngDevInquiryItem>[] = [
    { field: "company_name", headerName: "고객사", width: 180 },
    { field: "inquiry_content", headerName: "문의내용", flex: 1, minWidth: 220 },
    { field: "progress_code", headerName: "진행코드", width: 120 },
    {
      field: "is_confirmed",
      headerName: "확정",
      width: 90,
      valueFormatter: (params) => (params.value ? "Y" : "N"),
    },
  ];

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function selectItem(item: MngDevInquiryItem) {
    setForm(toForm(item));
  }

  async function saveItem() {
    if (!form.company_id) {
      toast.error("고객사를 선택해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : null),
        company_id: Number(form.company_id),
        inquiry_content: form.inquiry_content || null,
        hoped_start_date: form.hoped_start_date || null,
        estimated_man_months: form.estimated_man_months ? Number(form.estimated_man_months) : null,
        sales_rep_name: form.sales_rep_name || null,
        client_contact_name: form.client_contact_name || null,
        progress_code: form.progress_code || null,
        project_name: form.project_name || null,
        note: form.note || null,
        is_confirmed: form.is_confirmed,
      };

      const response = await fetch("/api/mng/dev-inquiries", {
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
    if (!confirm("선택한 문의를 삭제할까요?")) return;

    setSaving(true);
    try {
      const response = await fetch("/api/mng/dev-inquiries", {
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
          <CardTitle>문의 목록</CardTitle>
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
          <MngSimpleGrid<MngDevInquiryItem>
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
          <CardTitle>문의 상세</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
            value={form.inquiry_content}
            onChange={(event) => setForm((prev) => ({ ...prev, inquiry_content: event.target.value }))}
            placeholder="문의 내용"
          />
          <Input
            value={form.progress_code}
            onChange={(event) => setForm((prev) => ({ ...prev, progress_code: event.target.value }))}
            placeholder="진행 코드"
          />
          <CustomDatePicker
            value={form.hoped_start_date}
            onChange={(value) => setForm((prev) => ({ ...prev, hoped_start_date: value }))}
            holidays={HOLIDAY_DATE_KEYS}
          />
          <Input
            value={form.estimated_man_months}
            onChange={(event) => setForm((prev) => ({ ...prev, estimated_man_months: event.target.value }))}
            placeholder="예상 MM"
          />
          <Input
            value={form.sales_rep_name}
            onChange={(event) => setForm((prev) => ({ ...prev, sales_rep_name: event.target.value }))}
            placeholder="영업 담당"
          />
          <Input
            value={form.client_contact_name}
            onChange={(event) => setForm((prev) => ({ ...prev, client_contact_name: event.target.value }))}
            placeholder="고객 담당"
          />
          <Input
            value={form.project_name}
            onChange={(event) => setForm((prev) => ({ ...prev, project_name: event.target.value }))}
            placeholder="프로젝트명"
          />
          <Input
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="비고"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.is_confirmed}
              onChange={(event) => setForm((prev) => ({ ...prev, is_confirmed: event.target.checked }))}
            />
            확정 여부
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
