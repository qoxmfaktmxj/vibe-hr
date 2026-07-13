"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";

import { VibeGrid } from "@/components/grid/vibe-grid";
import type { ReadonlyGridRow } from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";
import type { WelBenefitTypeItem, WelBenefitTypeListResponse } from "@/types/welfare";

const BASE_URL = "/api/wel/benefit-types";

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

  // The summary cards need the full loaded set for counts (지급/공제/활성),
  // which VibeGrid's internal paginated fetch does not expose to the parent.
  // A dedicated fetch at the API's max limit (200) keeps this decoupled from
  // VibeGrid's own pagination state.
  const { data: allData } = useSWR<WelBenefitTypeListResponse>(`${BASE_URL}?page=1&limit=200`, fetcher, {
    revalidateOnFocus: false,
  });
  const allItems = allData?.items ?? [];
  const activeCount = allItems.filter((item) => item.is_active).length;
  const deductionCount = allItems.filter((item) => item.is_deduction).length;
  const paymentCount = allItems.length - deductionCount;

  // Client-side keyword filter applied after fetch (same as before: only the
  // current page's fetched rows are searched, not the full server-side set).
  const transformRows = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return (rows: BenefitTypeGridRow[]) => {
      if (!keyword) return rows;
      return rows.filter(
        (row) =>
          row.code.toLowerCase().includes(keyword) ||
          row.name.toLowerCase().includes(keyword) ||
          row.module_path.toLowerCase().includes(keyword) ||
          (row.pay_item_code ?? "").toLowerCase().includes(keyword),
      );
    };
  }, [appliedKeyword]);

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
    <VibeGrid<WelBenefitTypeItem>
      registryKey="wel.benefit-types"
      title="복리후생 유형관리"
      variant="readonly"
      columns={columnDefs}
      fetchUrl={BASE_URL}
      transformRows={transformRows}
      pageSize={50}
      downloadFileName="wel-benefit-types"
      emptyText="복리후생 유형 데이터가 없습니다."
      onQueryStart={() => setAppliedKeyword(keywordInput)}
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
    />
  );
}
