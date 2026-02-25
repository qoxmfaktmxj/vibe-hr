"use client";

import { useState } from "react";
import useSWR from "swr";
import type { ColDef } from "ag-grid-community";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MngSimpleGrid } from "@/components/mng/mng-simple-grid";
import { fetcher } from "@/lib/fetcher";
import type {
  MngCompanyDropdownResponse,
  MngDevStaffProjectItem,
  MngDevStaffRevenueItem,
  MngDevStaffProjectListResponse,
  MngDevStaffRevenueSummaryResponse,
} from "@/types/mng";

export function DevStaffViewer() {
  const [companyFilter, setCompanyFilter] = useState("");

  const query = companyFilter ? `?company_id=${companyFilter}` : "";
  const { data: projectData } = useSWR<MngDevStaffProjectListResponse>(`/api/mng/dev-staff/projects${query}`, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: revenueData } = useSWR<MngDevStaffRevenueSummaryResponse>(
    `/api/mng/dev-staff/revenue-summary${query}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });

  const projects = projectData?.items ?? [];
  const revenues = revenueData?.items ?? [];
  const companies = companyData?.companies ?? [];
  const projectColumnDefs: ColDef<MngDevStaffProjectItem>[] = [
    { field: "project_name", headerName: "프로젝트", flex: 1, minWidth: 180 },
    { field: "company_name", headerName: "고객사", width: 160 },
    { field: "assigned_staff", headerName: "담당인력", width: 160 },
    { field: "actual_man_months", headerName: "실투입MM", width: 120 },
    {
      field: "contract_amount",
      headerName: "계약금액",
      width: 130,
      valueFormatter: (params) => (params.value ? Number(params.value).toLocaleString() : "-"),
    },
  ];
  const revenueColumnDefs: ColDef<MngDevStaffRevenueItem>[] = [
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
      headerName: "실투입MM 합계",
      width: 150,
      valueFormatter: (params) => Number(params.value ?? 0).toFixed(2),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>프로젝트별 인력 현황</CardTitle>
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
        </CardHeader>
        <CardContent>
          <MngSimpleGrid<MngDevStaffProjectItem>
            rowData={projects}
            columnDefs={projectColumnDefs}
            getRowId={(row) => String(row.project_id)}
            height={340}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>월별 매출/투입 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <MngSimpleGrid<MngDevStaffRevenueItem>
            rowData={revenues}
            columnDefs={revenueColumnDefs}
            getRowId={(row) => row.month}
            height={300}
          />
        </CardContent>
      </Card>
    </div>
  );
}
