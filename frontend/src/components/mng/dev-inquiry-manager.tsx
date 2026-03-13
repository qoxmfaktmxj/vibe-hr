"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";
import { toast } from "sonner";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid } from "@/components/grid/search-controls";
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

type InquiryGridRow = MngDevInquiryItem & ReadonlyGridRow;

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
  const [companyFilterInput, setCompanyFilterInput] = useState("");
  const [appliedCompanyFilter, setAppliedCompanyFilter] = useState("");
  const [form, setForm] = useState<InquiryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (appliedCompanyFilter) params.set("company_id", appliedCompanyFilter);
    return `/api/mng/dev-inquiries?${params.toString()}`;
  }, [appliedCompanyFilter, page]);

  const { data, mutate, isLoading } = useSWR<MngDevInquiryListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const companies = companyData?.companies ?? [];
  const rowData = useMemo<InquiryGridRow[]>(() => createReadonlyGridRows(items), [items]);

  const columnDefs = useMemo<ColDef<InquiryGridRow>[]>(
    () => [
      { field: "company_name", headerName: "고객사", width: 180 },
      { field: "inquiry_content", headerName: "문의내용", minWidth: 220, flex: 1.2 },
      { field: "progress_code", headerName: "진행코드", width: 120 },
      { field: "project_name", headerName: "프로젝트명", width: 160 },
      {
        field: "is_confirmed",
        headerName: "확정",
        width: 90,
        valueFormatter: (params) => (params.value ? "Y" : "N"),
      },
    ],
    [],
  );

  function resetForm() {
    setForm(EMPTY_FORM);
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
    <ReadonlyGridManager<InquiryGridRow>
      title="개발 문의 관리"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-[220px_1fr]">
          <select
            value={companyFilterInput}
            onChange={(event) => setCompanyFilterInput(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">전체 고객사</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
          </select>
          <div className="flex items-center text-sm text-slate-500">
            고객 문의 접수, 확정 여부, 예상 투입량을 관리합니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">문의 상세</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <select
                value={form.company_id}
                onChange={(event) => setForm((prev) => ({ ...prev, company_id: event.target.value }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">고객사 선택</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </select>
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
                value={form.inquiry_content}
                onChange={(event) => setForm((prev) => ({ ...prev, inquiry_content: event.target.value }))}
                placeholder="문의 내용"
                className="xl:col-span-2"
              />
              <Input
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="비고"
                className="xl:col-span-2"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
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
                <Button variant="outline" onClick={resetForm} disabled={saving}>
                  초기화
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      }
      rowData={rowData}
      columnDefs={columnDefs}
      totalCount={data?.total_count ?? 0}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      selectedRowId={form.id}
      onRowClick={(row) => setForm(toForm(row))}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedCompanyFilter(companyFilterInput);
        void mutate();
      }}
      queryDisabled={saving || isLoading}
      loading={isLoading}
      emptyText="개발 문의 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
