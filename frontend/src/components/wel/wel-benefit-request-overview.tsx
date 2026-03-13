"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";
import type { WelBenefitRequestItem, WelBenefitRequestListResponse } from "@/types/welfare";

type BenefitRequestGridRow = WelBenefitRequestItem & ReadonlyGridRow;

const STATUS_LABELS: Record<string, string> = {
  draft: "작성중",
  submitted: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  payroll_reflected: "급여 반영",
  withdrawn: "회수",
};

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number | null) {
  if (value === null) return "-";
  return `${value.toLocaleString("ko-KR")}원`;
}

export function WelBenefitRequestOverview() {
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusInput, setStatusInput] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    return `/api/wel/requests?${params.toString()}`;
  }, [page]);

  const { data, isLoading, mutate } = useSWR<WelBenefitRequestListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const filteredItems = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return items.filter((item) => {
      if (appliedStatus && item.status_code !== appliedStatus) return false;
      if (!keyword) return true;
      return (
        item.request_no.toLowerCase().includes(keyword) ||
        item.employee_name.toLowerCase().includes(keyword) ||
        item.employee_no.toLowerCase().includes(keyword) ||
        item.benefit_type_name.toLowerCase().includes(keyword)
      );
    });
  }, [appliedKeyword, appliedStatus, items]);

  const rowData = useMemo<BenefitRequestGridRow[]>(
    () => createReadonlyGridRows(filteredItems),
    [filteredItems],
  );

  const submittedCount = items.filter((item) => item.status_code === "submitted").length;
  const approvedCount = items.filter(
    (item) => item.status_code === "approved" || item.status_code === "payroll_reflected",
  ).length;
  const reflectedCount = items.filter((item) => item.status_code === "payroll_reflected").length;
  const reflectedAmount = items
    .filter((item) => item.status_code === "payroll_reflected")
    .reduce((sum, item) => sum + (item.approved_amount ?? 0), 0);

  const columnDefs = useMemo<ColDef<BenefitRequestGridRow>[]>(
    () => [
      { field: "request_no", headerName: "신청번호", width: 150 },
      { field: "benefit_type_name", headerName: "복리후생 유형", minWidth: 150, flex: 1 },
      {
        headerName: "신청자",
        minWidth: 200,
        flex: 1.2,
        valueGetter: (params) =>
          params.data
            ? `${params.data.employee_name} (${params.data.employee_no}) / ${params.data.department_name}`
            : "",
      },
      {
        field: "status_code",
        headerName: "상태",
        width: 120,
        valueFormatter: (params) => STATUS_LABELS[String(params.value ?? "")] ?? params.value,
      },
      {
        field: "requested_amount",
        headerName: "신청금액",
        width: 130,
        valueFormatter: (params) => formatCurrency(Number(params.value ?? 0)),
      },
      {
        field: "approved_amount",
        headerName: "승인금액",
        width: 130,
        valueFormatter: (params) => formatCurrency((params.value as number | null) ?? null),
      },
      { field: "payroll_run_label", headerName: "급여 반영", minWidth: 160, flex: 1 },
      {
        field: "requested_at",
        headerName: "신청일",
        width: 120,
        valueFormatter: (params) => String(params.value ?? "").slice(0, 10),
      },
    ],
    [],
  );

  return (
    <ReadonlyGridManager<BenefitRequestGridRow>
      title="복리후생 신청현황"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-[1fr_200px]">
          <SearchTextField
            value={keywordInput}
            onChange={setKeywordInput}
            placeholder="신청번호, 사번, 이름, 복리후생 유형"
          />
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={statusInput}
            onChange={(event) => setStatusInput(event.target.value)}
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </SearchFieldGrid>
      }
      beforeGrid={
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard title="전체 신청" value={String(items.length)} description="현재 페이지에 적재된 신청 건수" />
          <SummaryCard title="승인 대기" value={String(submittedCount)} description="승인 처리 대기중인 신청" />
          <SummaryCard title="승인 완료" value={String(approvedCount)} description="후속 처리가 가능한 신청" />
          <SummaryCard
            title="급여 반영"
            value={formatCurrency(reflectedAmount)}
            description={`${reflectedCount}건이 급여와 연결됨`}
          />
        </div>
      }
      rowData={rowData}
      columnDefs={columnDefs}
      totalCount={appliedKeyword || appliedStatus ? filteredItems.length : (data?.total_count ?? 0)}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedKeyword(keywordInput);
        setAppliedStatus(statusInput);
        void mutate();
      }}
      loading={isLoading}
      emptyText="복리후생 신청 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
