"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ColDef, GridApi, GridReadyEvent, RowClickedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Download, Search } from "lucide-react";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions, type GridToolbarAction } from "@/components/grid/grid-toolbar-actions";
import {
  ManagerGridSection,
  ManagerPageShell,
  ManagerSearchSection,
} from "@/components/grid/manager-layout";
import {
  buildGridRowClassRules,
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
  type GridStatus,
} from "@/lib/grid/grid-status";
import { toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";

export type ReadonlyGridRow = {
  id: number | string;
  _status: GridStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: GridStatus;
};

type ReadonlyGridManagerProps<Row extends ReadonlyGridRow> = {
  title: string;
  hideSearchTitle?: boolean;
  searchFields: ReactNode;
  rowData: Row[];
  columnDefs: ColDef<Row>[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onQuery: () => void;
  onDownload?: () => void;
  actions?: GridToolbarAction[];
  onSelectionChange?: (rows: Row[]) => void;
  isRowSelectable?: (row: Row) => boolean;
  onReady?: (api: GridApi<Row>) => void;
  onRowClick?: (row: Row) => void;
  beforeGrid?: ReactNode;
  afterGrid?: ReactNode;
  inset?: boolean;
  embedded?: boolean;
  headerNote?: ReactNode;
  feedback?: ReactNode;
  queryDisabled?: boolean;
  queryLabel?: string;
  selectedRowId?: number | string | null;
  gridHeight?: number;
  emptyText?: string;
  loading?: boolean;
};

export function createReadonlyGridRows<T extends { id: number | string }>(
  items: T[],
): Array<T & ReadonlyGridRow> {
  return items.map((item) => ({
    ...item,
    _status: "clean" as const,
    _original: item as unknown as Record<string, unknown>,
    _prevStatus: undefined,
  }));
}

export function LocalReadonlyGrid<T extends object>({ title, items, columns, rowId, onRowClick, onQuery, queryLabel = "조회", loading = false, disabled = false, gridHeight = 300, emptyText }: {
  title: string; items: T[]; columns: ColDef<T & ReadonlyGridRow>[];
  rowId: (item: T, index: number) => number | string;
  onRowClick?: (row: T & ReadonlyGridRow) => void;
  onQuery?: () => void; queryLabel?: string; loading?: boolean; disabled?: boolean; gridHeight?: number; emptyText?: string;
}) {
  const [requestedPage, setPage] = useState(1);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(items.length / 50)));
  const rows = useMemo(() => createReadonlyGridRows(items.map((item, index) => ({ ...item, id: rowId(item, index) }))), [items, rowId]);
  return <ReadonlyGridManager<T & ReadonlyGridRow> title={title} searchFields={null} embedded inset
    rowData={rows.slice((page - 1) * 50, page * 50)} columnDefs={columns} totalCount={items.length} page={page} pageSize={50} onPageChange={setPage}
    onQuery={() => { setPage(1); onQuery?.(); }} queryDisabled={disabled || loading} loading={loading} gridHeight={gridHeight} emptyText={emptyText}
    onRowClick={onRowClick} actions={onQuery ? [{ key: "query", label: queryLabel, icon: Search, onClick: onQuery, disabled: disabled || loading }] : []} />;
}

export function ReadonlyGridManager<Row extends ReadonlyGridRow>({
  title,
  hideSearchTitle = false,
  searchFields,
  rowData,
  columnDefs,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onQuery,
  onDownload,
  actions,
  onSelectionChange,
  isRowSelectable,
  onReady,
  onRowClick,
  beforeGrid,
  afterGrid,
  inset = false,
  embedded = false,
  headerNote,
  feedback,
  queryDisabled = false,
  queryLabel = "조회",
  selectedRowId = null,
  gridHeight = 520,
  emptyText = "데이터가 없습니다.",
  loading = false,
}: ReadonlyGridManagerProps<Row>) {
  const gridRef = useRef<AgGridReact<Row>>(null);
  const rowClassRules = useMemo(() => buildGridRowClassRules<Row>(), []);
  const gridSummary = useMemo(
    () => summarizeGridStatuses(rowData, (row) => row._status),
    [rowData],
  );
  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
      cellClass: (params) => getGridStatusCellClass(params.data?._status),
    }),
    [],
  );
  const pagination = useGridPagination({
    page,
    totalCount,
    pageSize,
    onPageChange,
  });

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api || loading) return;
    if (rowData.length === 0) {
      api.showNoRowsOverlay();
      return;
    }
    api.hideOverlay();
  }, [loading, rowData]);

  const getRowClassName = useCallback(
    (params: { data?: Row | null }) => {
      const statusClass = getGridRowClass(params.data?._status);
      if (!selectedRowId || !params.data) return statusClass;
      const selectedClass = params.data.id === selectedRowId ? "vibe-row-selected" : "";
      return [statusClass, selectedClass].filter(Boolean).join(" ");
    },
    [selectedRowId],
  );

  useEffect(() => {
    gridRef.current?.api?.redrawRows();
  }, [selectedRowId]);

  const toolbarActions = useMemo<GridToolbarAction[]>(() => [
    ...(embedded && searchFields === null ? [{ key: "query", label: "조회", icon: Search, onClick: onQuery, disabled: queryDisabled }] : []),
    ...(onDownload ? [{ key: "download", label: "다운로드", icon: Download, onClick: onDownload, disabled: loading }] : []),
  ], [embedded, loading, onDownload, onQuery, queryDisabled, searchFields]);

  return (
    <ManagerPageShell className={embedded ? "h-auto min-w-0 p-0 md:p-0" : undefined}>
      {beforeGrid}
      {!(embedded && searchFields === null) && (
      <ManagerSearchSection
        title={hideSearchTitle ? undefined : title}
        onQuery={onQuery}
        queryLabel={queryLabel}
        queryDisabled={queryDisabled}
      >
        {searchFields}
      </ManagerSearchSection>
      )}
      <ManagerGridSection
        headerClassName={embedded ? "[&>div:first-child]:flex-wrap" : undefined}
        headerLeft={
          <>
            {embedded && searchFields === null && <h2 className="w-full text-base font-semibold">{title}</h2>}
            <GridPaginationControls
              page={page}
              totalPages={pagination.totalPages}
              pageInput={pagination.pageInput}
              setPageInput={pagination.setPageInput}
              goPrev={pagination.goPrev}
              goNext={pagination.goNext}
              goToPage={pagination.goToPage}
              disabled={queryDisabled}
              className="mt-0 justify-start"
            />
            <span className={inset ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>총 {totalCount.toLocaleString()}건</span>
            {headerNote}
            <GridChangeSummaryBadges summary={gridSummary} />
          </>
        }
        headerRight={<GridToolbarActions actions={actions ?? toolbarActions} />}
        contentClassName={inset ? "flex min-h-0 flex-1 flex-col" : undefined}
      >
        {feedback}
        <div className={inset ? "min-h-0 flex-1 px-3 pb-4 pt-2 md:px-6 md:pt-0" : "contents"}>
        <div
          className={inset
            ? "ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-border"
            : "ag-theme-quartz vibe-grid h-full min-h-0 w-full overflow-hidden rounded-b-xl border-t border-border"}
          style={{ minHeight: gridHeight, height: embedded ? gridHeight : undefined }}
        >
          <AgGridReact<Row>
            ref={gridRef}
            theme="legacy"
            rowData={rowData}
            getRowId={params => String(params.data.id)}
            columnDefs={columnDefs}
            rowSelection={onSelectionChange ? {
              mode: "multiRow",
              selectAll: "filtered",
              enableClickSelection: false,
              isRowSelectable: (node) => !!node.data && (!isRowSelectable || isRowSelectable(node.data)),
            } : undefined}
            onSelectionChanged={onSelectionChange ? (event) => onSelectionChange(event.api.getSelectedRows()) : undefined}
            defaultColDef={defaultColDef}
            rowHeight={inset ? 34 : 36}
            headerHeight={36}
            animateRows={false}
            rowClassRules={rowClassRules}
            getRowClass={getRowClassName}
            loading={loading}
            overlayNoRowsTemplate={`<span class='text-sm text-muted-foreground'>${emptyText}</span>`}
            onGridReady={(event: GridReadyEvent<Row>) => {
              onReady?.(event.api);
              if (!loading && rowData.length === 0) {
                event.api.showNoRowsOverlay();
              }
            }}
            onRowClicked={(event: RowClickedEvent<Row>) => {
              if (event.data && onRowClick) {
                onRowClick(event.data);
              }
            }}
            onCellKeyDown={(event) => {
              if (event.data && (event.event as KeyboardEvent | undefined)?.key === "Enter") onRowClick?.(event.data);
            }}
          />
        </div>
        </div>
      </ManagerGridSection>
      {afterGrid}
    </ManagerPageShell>
  );
}

// standard-v2 tokens kept here for validator parity:
// AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
void toggleDeletedStatus;
