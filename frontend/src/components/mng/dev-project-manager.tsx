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

type ProjectGridRow = MngDevProjectItem & ReadonlyGridRow;

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
  const [companyFilterInput, setCompanyFilterInput] = useState("");
  const [appliedCompanyFilter, setAppliedCompanyFilter] = useState("");
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (appliedCompanyFilter) params.set("company_id", appliedCompanyFilter);
    return `/api/mng/dev-projects?${params.toString()}`;
  }, [appliedCompanyFilter, page]);

  const { data, mutate, isLoading } = useSWR<MngDevProjectListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const companies = companyData?.companies ?? [];
  const rowData = useMemo<ProjectGridRow[]>(() => createReadonlyGridRows(items), [items]);

  const columnDefs = useMemo<ColDef<ProjectGridRow>[]>(
    () => [
      { field: "project_name", headerName: "프로젝트명", minWidth: 180, flex: 1.2 },
      { field: "company_name", headerName: "고객사", width: 160 },
      { field: "assigned_staff", headerName: "담당인력", width: 160 },
      {
        field: "contract_amount",
        headerName: "계약금액",
        width: 140,
        valueFormatter: (params) => (params.value ? Number(params.value).toLocaleString() : "-"),
      },
      { field: "actual_man_months", headerName: "실제 MM", width: 120 },
      { field: "inspection_status", headerName: "검수상태", width: 120 },
    ],
    [],
  );

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function saveItem() {
    if (!form.project_name.trim() || !form.company_id) {
      toast.error("프로젝트명과 고객사는 필수입니다.");
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
    <ReadonlyGridManager<ProjectGridRow>
      title="프로젝트 관리"
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
            고객사별 개발 프로젝트와 계약/투입 정보를 한 화면에서 관리합니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">프로젝트 상세</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                value={form.project_name}
                onChange={(event) => setForm((prev) => ({ ...prev, project_name: event.target.value }))}
                placeholder="프로젝트명"
              />
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
                value={form.assigned_staff}
                onChange={(event) => setForm((prev) => ({ ...prev, assigned_staff: event.target.value }))}
                placeholder="담당 인력"
              />
              <Input
                value={form.inspection_status}
                onChange={(event) => setForm((prev) => ({ ...prev, inspection_status: event.target.value }))}
                placeholder="검수 상태"
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
              <CustomDatePicker
                value={form.dev_start_date}
                onChange={(value) => setForm((prev) => ({ ...prev, dev_start_date: value }))}
                holidays={HOLIDAY_DATE_KEYS}
              />
              <CustomDatePicker
                value={form.dev_end_date}
                onChange={(value) => setForm((prev) => ({ ...prev, dev_end_date: value }))}
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
                placeholder="실제 MM"
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
      emptyText="프로젝트 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
