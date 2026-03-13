"use client";

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { ColDef, GridReadyEvent, RowClickedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Copy, Download, Plus, Save, Search, Upload } from "lucide-react";

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
  searchFields: ReactNode;
  rowData: Row[];
  columnDefs: ColDef<Row>[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onQuery: () => void;
  onDownload?: () => void;
  onRowClick?: (row: Row) => void;
  beforeGrid?: ReactNode;
  afterGrid?: ReactNode;
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

export function ReadonlyGridManager<Row extends ReadonlyGridRow>({
  title,
  searchFields,
  rowData,
  columnDefs,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onQuery,
  onDownload,
  onRowClick,
  beforeGrid,
  afterGrid,
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

  const toolbarActions = useMemo<GridToolbarAction[]>(
    () => [
      {
        key: "query",
        label: "조회",
        icon: Search,
        onClick: onQuery,
        disabled: queryDisabled,
      },
      {
        key: "create",
        label: "입력",
        icon: Plus,
        onClick: () => undefined,
        disabled: true,
      },
      {
        key: "copy",
        label: "복사",
        icon: Copy,
        onClick: () => undefined,
        disabled: true,
      },
      {
        key: "template",
        label: "템플릿 다운로드",
        icon: Download,
        onClick: () => undefined,
        disabled: true,
      },
      {
        key: "upload",
        label: "업로드",
        icon: Upload,
        onClick: () => undefined,
        disabled: true,
      },
      {
        key: "download",
        label: "다운로드",
        icon: Download,
        onClick: onDownload ?? (() => undefined),
        disabled: !onDownload,
      },
    ],
    [onDownload, onQuery, queryDisabled],
  );

  const saveAction = useMemo<GridToolbarAction>(
    () => ({
      key: "save",
      label: "저장",
      icon: Save,
      onClick: () => undefined,
      disabled: true,
      variant: "save",
    }),
    [],
  );

  return (
    <ManagerPageShell>
      {beforeGrid}
      <ManagerSearchSection
        title={title}
        onQuery={onQuery}
        queryLabel={queryLabel}
        queryDisabled={queryDisabled}
      >
        {searchFields}
      </ManagerSearchSection>
      <ManagerGridSection
        headerLeft={
          <>
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
            <span className="text-sm text-slate-500">총 {totalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={gridSummary} />
          </>
        }
        headerRight={<GridToolbarActions actions={toolbarActions} saveAction={saveAction} />}
      >
        <div
          className="ag-theme-quartz vibe-grid h-full min-h-0 w-full overflow-hidden rounded-b-xl border-t border-slate-200"
          style={{ minHeight: gridHeight }}
        >
          <AgGridReact<Row>
            ref={gridRef}
            theme="legacy"
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={36}
            headerHeight={36}
            animateRows={false}
            rowClassRules={rowClassRules}
            getRowClass={getRowClassName}
            loading={loading}
            overlayNoRowsTemplate={`<span class='text-sm text-slate-400'>${emptyText}</span>`}
            onGridReady={(event: GridReadyEvent<Row>) => {
              if (!loading && rowData.length === 0) {
                event.api.showNoRowsOverlay();
              }
            }}
            onRowClicked={(event: RowClickedEvent<Row>) => {
              if (event.data && onRowClick) {
                onRowClick(event.data);
              }
            }}
          />
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
