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
import { MngSimpleGrid } from "@/components/mng/mng-simple-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import type {
  MngCompanyDropdownResponse,
  MngDevRequestItem,
  MngDevRequestListResponse,
  MngDevRequestMonthlySummaryItem,
  MngDevRequestMonthlySummaryResponse,
} from "@/types/mng";

type DevRequestForm = {
  id: number | null;
  company_id: string;
  request_ym: string;
  requester_name: string;
  status_code: string;
  request_content: string;
  is_paid: boolean;
  has_tax_bill: boolean;
  paid_man_months: string;
  actual_man_months: string;
  note: string;
};

type DevRequestGridRow = MngDevRequestItem & ReadonlyGridRow;

const EMPTY_FORM: DevRequestForm = {
  id: null,
  company_id: "",
  request_ym: new Date().toISOString().slice(0, 10),
  requester_name: "",
  status_code: "",
  request_content: "",
  is_paid: false,
  has_tax_bill: false,
  paid_man_months: "",
  actual_man_months: "",
  note: "",
};

function toForm(item: MngDevRequestItem): DevRequestForm {
  return {
    id: item.id,
    company_id: String(item.company_id),
    request_ym: item.request_ym,
    requester_name: item.requester_name ?? "",
    status_code: item.status_code ?? "",
    request_content: item.request_content ?? "",
    is_paid: item.is_paid,
    has_tax_bill: item.has_tax_bill,
    paid_man_months: item.paid_man_months?.toString() ?? "",
    actual_man_months: item.actual_man_months?.toString() ?? "",
    note: item.note ?? "",
  };
}

export function DevRequestManager() {
  const [companyFilterInput, setCompanyFilterInput] = useState("");
  const [appliedCompanyFilter, setAppliedCompanyFilter] = useState("");
  const [form, setForm] = useState<DevRequestForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (appliedCompanyFilter) params.set("company_id", appliedCompanyFilter);
    return `/api/mng/dev-requests?${params.toString()}`;
  }, [appliedCompanyFilter, page]);

  const monthlyQuery = useMemo(() => {
    const params = new URLSearchParams({
      page: "1",
      limit: "24",
    });
    if (appliedCompanyFilter) params.set("company_id", appliedCompanyFilter);
    return `/api/mng/dev-requests/monthly-summary?${params.toString()}`;
  }, [appliedCompanyFilter]);

  const { data, mutate, isLoading } = useSWR<MngDevRequestListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: monthlyData, mutate: mutateMonthly } = useSWR<MngDevRequestMonthlySummaryResponse>(
    monthlyQuery,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });

  const companies = companyData?.companies ?? [];
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const monthlyItems = monthlyData?.items ?? [];
  const rowData = useMemo<DevRequestGridRow[]>(() => createReadonlyGridRows(items), [items]);

  const requestColumnDefs = useMemo<ColDef<DevRequestGridRow>[]>(
    () => [
      { field: "request_ym", headerName: "요청월", width: 120 },
      { field: "request_seq", headerName: "순번", width: 90 },
      { field: "company_name", headerName: "고객사", width: 160 },
      { field: "requester_name", headerName: "요청자", width: 120 },
      { field: "status_code", headerName: "상태", width: 120 },
      { field: "request_content", headerName: "요청내용", minWidth: 220, flex: 1 },
      {
        field: "is_paid",
        headerName: "유상",
        width: 90,
        valueFormatter: (params) => (params.value ? "Y" : "N"),
      },
    ],
    [],
  );

  const summaryColumnDefs = useMemo<ColDef<MngDevRequestMonthlySummaryItem>[]>(
    () => [
      { field: "request_ym", headerName: "월", width: 120 },
      { field: "total_count", headerName: "요청건수", width: 120 },
      { field: "paid_count", headerName: "유상건수", width: 120 },
      {
        field: "paid_man_months_total",
        headerName: "유상 MM 합계",
        width: 140,
        valueFormatter: (params) => Number(params.value ?? 0).toFixed(2),
      },
      {
        field: "actual_man_months_total",
        headerName: "실제 MM 합계",
        width: 150,
        valueFormatter: (params) => Number(params.value ?? 0).toFixed(2),
      },
    ],
    [],
  );

  const seqByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = item.request_ym.slice(0, 7);
      map.set(key, Math.max(map.get(key) ?? 0, item.request_seq));
    }
    return map;
  }, [items]);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function saveItem() {
    if (!form.company_id) {
      toast.error("고객사를 선택해 주세요.");
      return;
    }
    if (!form.request_ym) {
      toast.error("요청일을 입력해 주세요.");
      return;
    }

    const monthKey = form.request_ym.slice(0, 7);
    const requestSeq = form.id ? undefined : (seqByMonth.get(monthKey) ?? 0) + 1;

    setSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : null),
        company_id: Number(form.company_id),
        request_ym: form.request_ym,
        request_seq: requestSeq,
        requester_name: form.requester_name || null,
        status_code: form.status_code || null,
        request_content: form.request_content || null,
        is_paid: form.is_paid,
        has_tax_bill: form.has_tax_bill,
        paid_man_months: form.paid_man_months ? Number(form.paid_man_months) : null,
        actual_man_months: form.actual_man_months ? Number(form.actual_man_months) : null,
        note: form.note || null,
      };

      const response = await fetch("/api/mng/dev-requests", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "저장에 실패했습니다.");

      toast.success("저장되었습니다.");
      await Promise.all([mutate(), mutateMonthly()]);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!form.id) return;
    if (!confirm("선택한 요청을 삭제할까요?")) return;

    setSaving(true);
    try {
      const response = await fetch("/api/mng/dev-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [form.id] }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "삭제에 실패했습니다.");

      toast.success("삭제되었습니다.");
      await Promise.all([mutate(), mutateMonthly()]);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReadonlyGridManager<DevRequestGridRow>
      title="추가 개발 요청 관리"
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
            고객사별 추가 개발 요청과 월별 유상 현황을 함께 확인합니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">요청 상세</CardTitle>
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
              <CustomDatePicker
                value={form.request_ym}
                onChange={(value) => setForm((prev) => ({ ...prev, request_ym: value }))}
                holidays={HOLIDAY_DATE_KEYS}
              />
              <Input
                value={form.requester_name}
                onChange={(event) => setForm((prev) => ({ ...prev, requester_name: event.target.value }))}
                placeholder="요청자명"
              />
              <Input
                value={form.status_code}
                onChange={(event) => setForm((prev) => ({ ...prev, status_code: event.target.value }))}
                placeholder="상태코드"
              />
              <Input
                value={form.paid_man_months}
                onChange={(event) => setForm((prev) => ({ ...prev, paid_man_months: event.target.value }))}
                placeholder="유상 MM"
              />
              <Input
                value={form.actual_man_months}
                onChange={(event) => setForm((prev) => ({ ...prev, actual_man_months: event.target.value }))}
                placeholder="실제 MM"
              />
              <Input
                value={form.request_content}
                onChange={(event) => setForm((prev) => ({ ...prev, request_content: event.target.value }))}
                placeholder="요청 내용"
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
                  checked={form.is_paid}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_paid: event.target.checked }))}
                />
                유상 여부
              </label>
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
      afterGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">월별 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <MngSimpleGrid<MngDevRequestMonthlySummaryItem>
              rowData={monthlyItems}
              columnDefs={summaryColumnDefs}
              getRowId={(row) => row.request_ym}
              height={260}
            />
          </CardContent>
        </Card>
      }
      rowData={rowData}
      columnDefs={requestColumnDefs}
      totalCount={data?.total_count ?? 0}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      selectedRowId={form.id}
      onRowClick={(row) => setForm(toForm(row))}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedCompanyFilter(companyFilterInput);
        void Promise.all([mutate(), mutateMonthly()]);
      }}
      queryDisabled={saving || isLoading}
      loading={isLoading}
      emptyText="추가 개발 요청 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
