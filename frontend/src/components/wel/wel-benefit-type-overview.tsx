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

type BenefitTypeGridRow = WelBenefitTypeItem & ReadonlyGridRow;function toXlsxSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet1";
}

async function downloadRowsAsXlsx<Row extends ReadonlyGridRow>(
  columns: ColDef<Row>[],
  rows: Row[],
  title: string,
  fileName: string,
) {
  const visibleColumns = columns.filter((column) => column.field || column.valueGetter);
  const headers = visibleColumns.map((column) => column.headerName ?? String(column.field ?? ""));
  const data = rows.map((row) =>
    visibleColumns.map((column) => {
      const field = column.field as keyof Row | undefined;
      const rawValue = field ? row[field] : undefined;
      if (typeof column.valueFormatter === "function") {
        return (column.valueFormatter as (params: { value: unknown; data: Row }) => string)({
          value: rawValue,
          data: row,
        }) ?? "";
      }
      return rawValue ?? "";
    }),
  );
  const { utils, writeFileXLSX } = await import("xlsx");
  const sheet = utils.aoa_to_sheet([headers, ...data]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, toXlsxSheetName(title));
  writeFileXLSX(workbook, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

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
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
  const { data: allData } = useSWR<WelBenefitTypeListResponse>(
    "/api/wel/benefit-types?page=1&limit=200",
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const allItems = allData?.items ?? [];
  const activeCount = allItems.filter((item) => item.is_active).length;
  const deductionCount = allItems.filter((item) => item.is_deduction).length;
  const paymentCount = allItems.length - deductionCount;
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
          <div className="flex items-center text-sm text-muted-foreground">
            신규 메뉴를 추가할 때 seed 유형이 이 화면에 바로 노출되도록 관리합니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard title="유형 수" value={String(allItems.length)} description="현재 적재된 복리후생 유형 수" />
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
      onDownload={() => void downloadRowsAsXlsx(columnDefs, rowData, "복리후생 유형관리", "wel-benefit-types")}
      totalCount={appliedKeyword.trim() ? filteredItems.length : (data?.total_count ?? 0)}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedKeyword(keywordInput);
        void mutate();
      }}
      queryDisabled={isLoading}
      loading={isLoading}
      emptyText="복리후생 유형 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
