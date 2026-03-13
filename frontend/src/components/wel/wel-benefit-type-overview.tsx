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
import type { WelBenefitTypeItem, WelBenefitTypeListResponse } from "@/types/welfare";

type BenefitTypeGridRow = WelBenefitTypeItem & ReadonlyGridRow;

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

export function WelBenefitTypeOverview() {
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    return `/api/wel/benefit-types?${params.toString()}`;
  }, [page]);

  const { data, isLoading, mutate } = useSWR<WelBenefitTypeListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const filteredItems = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      return (
        item.code.toLowerCase().includes(keyword) ||
        item.name.toLowerCase().includes(keyword) ||
        item.module_path.toLowerCase().includes(keyword) ||
        (item.pay_item_code ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [appliedKeyword, items]);

  const rowData = useMemo<BenefitTypeGridRow[]>(
    () => createReadonlyGridRows(filteredItems),
    [filteredItems],
  );

  const activeCount = items.filter((item) => item.is_active).length;
  const deductionCount = items.filter((item) => item.is_deduction).length;
  const paymentCount = items.length - deductionCount;

  const columnDefs = useMemo<ColDef<BenefitTypeGridRow>[]>(
    () => [
      { field: "code", headerName: "코드", width: 140 },
      { field: "name", headerName: "유형명", minWidth: 180, flex: 1 },
      { field: "module_path", headerName: "모듈 경로", minWidth: 180, flex: 1 },
      { field: "pay_item_code", headerName: "급여 항목", width: 140 },
      {
        field: "is_deduction",
        headerName: "지급/공제",
        width: 120,
        valueFormatter: (params) => (params.value ? "공제형" : "지급형"),
      },
      {
        field: "is_active",
        headerName: "사용여부",
        width: 110,
        valueFormatter: (params) => (params.value ? "사용" : "중지"),
      },
      { field: "sort_order", headerName: "정렬순서", width: 110 },
    ],
    [],
  );

  return (
    <ReadonlyGridManager<BenefitTypeGridRow>
      title="복리후생 유형관리"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-2">
          <SearchTextField
            value={keywordInput}
            onChange={setKeywordInput}
            placeholder="코드, 유형명, 모듈 경로, 급여 항목"
          />
          <div className="flex items-center text-sm text-slate-500">
            신규 메뉴를 추가할 때 seed 유형이 이 화면에 바로 노출되도록 관리합니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard title="유형 수" value={String(items.length)} description="현재 페이지에 적재된 복리후생 유형 수" />
          <SummaryCard
            title="지급형 / 공제형"
            value={`${paymentCount} / ${deductionCount}`}
            description="급여 연계 기준으로 분류한 결과"
          />
          <SummaryCard title="활성 유형" value={String(activeCount)} description="메뉴와 seed에서 바로 노출 가능한 유형" />
        </div>
      }
      rowData={rowData}
      columnDefs={columnDefs}
      totalCount={appliedKeyword ? filteredItems.length : (data?.total_count ?? 0)}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedKeyword(keywordInput);
        void mutate();
      }}
      loading={isLoading}
      emptyText="복리후생 유형 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
