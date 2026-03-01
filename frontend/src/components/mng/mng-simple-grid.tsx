"use client";

import { useMemo } from "react";
import {
  type ColDef,
  type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";


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
};

type MngSimpleGridProps<T extends Record<string, unknown>> = {
  rowData: T[];
  columnDefs: ColDef<T>[];
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  selectedRowId?: string | null;
  height?: number;
};

export function MngSimpleGrid<T extends Record<string, unknown>>({
  rowData,
  columnDefs,
  onRowClick,
  getRowId,
  selectedRowId,
  height = 320,
}: MngSimpleGridProps<T>) {
  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
    }),
    [],
  );

  return (
    <div className="ag-theme-quartz vibe-grid w-full overflow-hidden rounded border border-border" style={{ height }}>
      <AgGridReact<T>
        theme="legacy"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={false}
        localeText={AG_GRID_LOCALE_KO}
        rowHeight={36}
        headerHeight={36}
        getRowId={
          getRowId
            ? (params) => getRowId(params.data)
            : undefined
        }
        getRowClass={
          selectedRowId
            ? (params) => {
                if (!params.data) return "";
                const id = getRowId ? getRowId(params.data) : "";
                return id === selectedRowId ? "bg-primary/5" : "";
              }
            : undefined
        }
        onRowClicked={
          onRowClick
            ? (event: RowClickedEvent<T>) => {
                if (event.data) onRowClick(event.data);
              }
            : undefined
        }
        overlayNoRowsTemplate="<span class='text-sm text-slate-400'>데이터가 없습니다.</span>"
      />
    </div>
  );
}
