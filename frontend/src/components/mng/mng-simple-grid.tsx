"use client";

import { useMemo } from "react";
import type { ColDef, RowClickedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { cn } from "@/lib/utils";

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지",
  more: "더보기",
  to: "~",
  of: "/",
  next: "다음",
  last: "마지막",
  first: "처음",
  previous: "이전",
  loadingOoo: "로딩 중...",
  noRowsToShow: "데이터가 없습니다.",
  searchOoo: "검색...",
  blanks: "(빈값)",
  filterOoo: "필터...",
  applyFilter: "적용",
  equals: "같음",
  notEqual: "같지 않음",
  lessThan: "보다 작음",
  greaterThan: "보다 큼",
  contains: "포함",
  notContains: "미포함",
  startsWith: "시작",
  endsWith: "끝",
  andCondition: "그리고",
  orCondition: "또는",
  clearFilter: "초기화",
  resetFilter: "리셋",
  cancelFilter: "취소",
  textFilter: "텍스트 필터",
  numberFilter: "숫자 필터",
  dateFilter: "날짜 필터",
  selectAll: "전체 선택",
  selectAllSearchResults: "검색 결과 전체 선택",
  addCurrentSelectionToFilter: "현재 선택 추가",
  noMatches: "일치 항목 없음",
};

type MngSimpleGridProps<Row> = {
  rowData: Row[];
  columnDefs: ColDef<Row>[];
  onRowClick?: (row: Row) => void;
  getRowId?: (row: Row) => string;
  selectedRowId?: string | null;
  height?: number;
  className?: string;
};

export function MngSimpleGrid<Row>({
  rowData,
  columnDefs,
  onRowClick,
  getRowId,
  selectedRowId,
  height = 320,
  className,
}: MngSimpleGridProps<Row>) {
  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 100,
    }),
    [],
  );

  return (
    <AgGridModulesProvider>
      <div
        className={cn("ag-theme-quartz vibe-grid w-full overflow-hidden rounded-xl border border-slate-200", className)}
        style={{ height }}
      >
        <AgGridReact<Row>
          theme="legacy"
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={36}
          headerHeight={36}
          localeText={AG_GRID_LOCALE_KO}
          getRowId={getRowId ? (params) => getRowId(params.data) : undefined}
          getRowClass={(params) => {
            if (!selectedRowId || !getRowId || !params.data) return "";
            return getRowId(params.data) === selectedRowId ? "vibe-row-selected" : "";
          }}
          overlayNoRowsTemplate="<span class='text-sm text-slate-400'>데이터가 없습니다.</span>"
          onRowClicked={(event: RowClickedEvent<Row>) => {
            if (event.data && onRowClick) {
              onRowClick(event.data);
            }
          }}
        />
      </div>
    </AgGridModulesProvider>
  );
}
