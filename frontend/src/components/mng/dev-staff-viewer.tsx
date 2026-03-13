"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
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

type DevStaffProjectGridRow = (MngDevStaffProjectItem & { id: number }) & ReadonlyGridRow;

export function DevStaffViewer() {
  const [companyFilterInput, setCompanyFilterInput] = useState("");
  const [appliedCompanyFilter, setAppliedCompanyFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const projectsKey = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (appliedCompanyFilter) params.set("company_id", appliedCompanyFilter);
    return `/api/mng/dev-staff/projects?${params.toString()}`;
  }, [appliedCompanyFilter, page]);

  const revenueKey = useMemo(() => {
    const params = new URLSearchParams({
      page: "1",
      limit: "24",
    });
    if (appliedCompanyFilter) params.set("company_id", appliedCompanyFilter);
    return `/api/mng/dev-staff/revenue-summary?${params.toString()}`;
  }, [appliedCompanyFilter]);

  const { data: projectData, isLoading, mutate: mutateProjects } = useSWR<MngDevStaffProjectListResponse>(
    projectsKey,
    fetcher,
    { revalidateOnFocus: false },
  );
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

  const rowData = useMemo<DevStaffProjectGridRow[]>(
    () =>
      createReadonlyGridRows(
        (projectData?.items ?? []).map((item) => ({
          ...item,
          id: item.project_id,
        })),
      ),
    [projectData?.items],
  );

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
    <ReadonlyGridManager<DevStaffProjectGridRow>
      title="프로젝트별 인력 현황"
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
            고객사별 투입 현황과 월별 매출/공수 요약을 함께 확인합니다.
          </div>
        </SearchFieldGrid>
      }
      afterGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">월별 매출/공수 요약</CardTitle>
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
      rowData={rowData}
      columnDefs={projectColumnDefs}
      totalCount={projectData?.total_count ?? 0}
      page={projectData?.page ?? page}
      pageSize={projectData?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedCompanyFilter(companyFilterInput);
        void Promise.all([mutateProjects(), mutateRevenue()]);
      }}
      queryDisabled={isLoading}
      loading={isLoading}
      emptyText="투입 프로젝트 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
