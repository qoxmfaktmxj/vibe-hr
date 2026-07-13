"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";

import { VibeGrid, type VibeGridListResponse } from "@/components/grid/vibe-grid";
import type { ReadonlyGridRow } from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import { MngSimpleGrid } from "@/components/mng/mng-simple-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";
import type {
  MngCompanyDropdownResponse,
  MngDevStaffProjectItem,
  MngDevStaffProjectListResponse,
  MngDevStaffRevenueItem,
  MngDevStaffRevenueSummaryResponse,
} from "@/types/mng";

const BASE_URL = "/api/mng/dev-staff/projects";

type DevStaffProjectGridRow = (MngDevStaffProjectItem & { id: number }) & ReadonlyGridRow;

export function DevStaffViewer() {
  const [companyFilterInput, setCompanyFilterInput] = useState("");
  const [appliedCompanyFilter, setAppliedCompanyFilter] = useState("");

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedCompanyFilter) params.set("company_id", appliedCompanyFilter);
    const qs = params.toString();
    return qs ? `${BASE_URL}?${qs}` : BASE_URL;
  }, [appliedCompanyFilter]);

  const revenueKey = useMemo(() => {
    const params = new URLSearchParams({ page: "1", limit: "24" });
    if (appliedCompanyFilter) params.set("company_id", appliedCompanyFilter);
    return `/api/mng/dev-staff/revenue-summary?${params.toString()}`;
  }, [appliedCompanyFilter]);

  const { data: revenueData, mutate: mutateRevenue } = useSWR<MngDevStaffRevenueSummaryResponse>(
    revenueKey,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });

  const revenues = revenueData?.items ?? [];
  const companies = companyData?.companies ?? [];

  // API rows key on `project_id`, not `id` — VibeGrid rows require `id`.
  const fetchAdapter = (json: unknown): VibeGridListResponse<MngDevStaffProjectItem & { id: number }> => {
    const response = json as MngDevStaffProjectListResponse;
    return {
      items: response.items.map((item) => ({ ...item, id: item.project_id })),
      total_count: response.total_count,
      page: response.page,
      limit: response.limit,
    };
  };

  const projectColumnDefs = useMemo<ColDef<DevStaffProjectGridRow>[]>(
    () => [
      { field: "project_name", headerName: "프로젝트", minWidth: 180, flex: 1.2 },
      { field: "company_name", headerName: "고객사", width: 160 },
      { field: "assigned_staff", headerName: "담당인력", width: 160 },
      { field: "actual_man_months", headerName: "실제 MM", width: 120 },
      {
        field: "contract_amount",
        headerName: "계약금액",
        width: 140,
        valueFormatter: (params) => (params.value ? Number(params.value).toLocaleString() : "-"),
      },
    ],
    [],
  );

  const revenueColumnDefs = useMemo<ColDef<MngDevStaffRevenueItem>[]>(
    () => [
      { field: "month", headerName: "월", width: 120 },
      { field: "project_count", headerName: "프로젝트 수", width: 120 },
      {
        field: "contract_amount_total",
        headerName: "계약금액 합계",
        width: 150,
        valueFormatter: (params) => Number(params.value ?? 0).toLocaleString(),
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

  return (
    <VibeGrid<MngDevStaffProjectItem & { id: number }>
      registryKey="mng.dev-staff"
      title="프로젝트별 인력 현황"
      variant="readonly"
      columns={projectColumnDefs}
      fetchUrl={fetchUrl}
      fetchAdapter={fetchAdapter}
      pageSize={50}
      downloadFileName="mng-dev-staff"
      emptyText="투입 프로젝트 데이터가 없습니다."
      onQueryStart={() => {
        setAppliedCompanyFilter(companyFilterInput);
        void mutateRevenue();
      }}
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
          <div className="flex items-center text-sm text-muted-foreground">
            고객사별 투입 현황과 월별 매출/공수 요약을 함께 확인합니다.
          </div>
        </SearchFieldGrid>
      }
      afterGrid={
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground">월별 매출/공수 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <MngSimpleGrid<MngDevStaffRevenueItem>
              rowData={revenues}
              columnDefs={revenueColumnDefs}
              getRowId={(row) => row.month}
              height={260}
            />
          </CardContent>
        </Card>
      }
    />
  );
}
