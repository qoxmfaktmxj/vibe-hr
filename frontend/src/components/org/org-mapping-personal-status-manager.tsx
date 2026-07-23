"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
import { toast } from "sonner";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses } from "@/lib/grid/grid-status";
import { toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  OrgMappingPersonalStatusListResponse,
  OrgMappingPersonalStatusRow,
} from "@/types/organization";

type RowData = OrgMappingPersonalStatusRow & {
  _status: "clean";
  _original: Record<string, unknown>;
  _prevStatus?: "clean";
};

// standard-v2 read-only contract tokens
void toggleDeletedStatus;
void getGridStatusCellClass;

const I18N = {
  title: "조직구분개인별현황",
  loadError: "조직구분개인별현황을 불러오지 못했습니다.",
  noRows: "조직구분개인별현황 데이터가 없습니다.",
  query: "조회",
  download: "다운로드",
};

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지", more: "더보기", to: "~", of: "/", next: "다음", last: "마지막", first: "처음", previous: "이전",
  loadingOoo: "로딩 중...", noRowsToShow: "데이터가 없습니다.", searchOoo: "검색...", blanks: "(빈값)",
  filterOoo: "필터...", applyFilter: "적용", equals: "같음", notEqual: "같지 않음", contains: "포함",
  notContains: "포함하지 않음", startsWith: "시작", endsWith: "끝", andCondition: "그리고", orCondition: "또는",
  selectAll: "전체 선택", noMatches: "일치 항목 없음",
};

function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toGridRow(row: OrgMappingPersonalStatusRow): RowData {
  return { ...row, _status: "clean", _original: { ...row } };
}

export function OrgMappingPersonalStatusManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/org/type-personal-status");
  const [referenceDate, setReferenceDate] = useState(currentDate);
  const [appliedReferenceDate, setAppliedReferenceDate] = useState(currentDate);
  const [rows, setRows] = useState<RowData[]>([]);
  const [typeColumns, setTypeColumns] = useState<OrgMappingPersonalStatusListResponse["type_columns"]>([]);
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const gridApiRef = useRef<GridApi<RowData> | null>(null);
  const pageSize = 100;

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        reference_date: appliedReferenceDate,
        page: String(page),
        limit: String(pageSize),
      });
      const response = await fetch(`/api/org/mapping-personal-status?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(I18N.loadError);
      const data = (await response.json()) as OrgMappingPersonalStatusListResponse;
      setRows((data.items ?? []).map(toGridRow));
      setTypeColumns(data.type_columns ?? []);
      setTotalCount(data.total_count ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.loadError);
      setRows([]);
      setTypeColumns([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [appliedReferenceDate, page]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, reloadVersion]);

  const defaultColDef = useMemo<ColDef<RowData>>(
    () => ({ sortable: true, filter: true, resizable: true, editable: false, suppressMovable: true, minWidth: 100 }),
    [],
  );

  const columnDefs = useMemo<ColDef<RowData>[]>(() => [
    { headerName: "사번", field: "employee_no", pinned: "left", width: 120, editable: false },
    { headerName: "성명", field: "display_name", pinned: "left", width: 120, editable: false },
    { headerName: "부서코드", field: "department_code", width: 130, editable: false },
    { headerName: "부서명", field: "department_name", minWidth: 150, flex: 1, editable: false },
    { headerName: "직위", field: "position_title", width: 130, editable: false },
    ...typeColumns.map((column) => ({
      headerName: column.name,
      colId: `mapping-${column.type_code}`,
      minWidth: 140,
      editable: false,
      valueGetter: (params) => params.data?.mappings[column.type_code]?.item_name ?? "",
    })),
  ], [typeColumns]);

  const changeSummary = useMemo(() => summarizeGridStatuses(rows, (row) => row._status), [rows]);
  const rowClassRules = useMemo(() => buildGridRowClassRules<RowData>(), []);
  const getRowClass = useCallback((params: { data?: RowData }) => getGridRowClass(params.data?._status), []);
  const { totalPages, pageInput, setPageInput, goPrev, goNext, goToPage } = useGridPagination({
    page,
    totalCount,
    pageSize,
    onPageChange: setPage,
  });

  const downloadXlsx = useCallback(async () => {
    const XLSX = await import("xlsx");
    const exportRows = rows.map((row) => ({
      사번: row.employee_no,
      성명: row.display_name,
      부서코드: row.department_code,
      부서명: row.department_name,
      직위: row.position_title,
      ...Object.fromEntries(typeColumns.map((column) => [column.name, row.mappings[column.type_code]?.item_name ?? ""])),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), I18N.title);
    XLSX.writeFile(workbook, "org-mapping-personal-status.xlsx");
  }, [rows, typeColumns]);

  const handleQuery = useCallback(() => {
    setPage(1);
    setAppliedReferenceDate(referenceDate);
    setReloadVersion((version) => version + 1);
  }, [referenceDate]);

  const toolbarActions = [
    {
      key: "query",
      label: I18N.query,
      icon: Search,
      onClick: handleQuery,
      disabled: loading || menuActionLoading,
    },
    {
      key: "download",
      label: I18N.download,
      icon: Download,
      onClick: () => void downloadXlsx(),
      disabled: loading,
    },
  ].filter((action) => can(action.key));

  return (
    <ManagerPageShell>
      <ManagerSearchSection
        title={I18N.title}
        onQuery={handleQuery}
        queryLabel={I18N.query}
        queryDisabled={loading || menuActionLoading || !can("query")}
      >
        <SearchFieldGrid className="xl:grid-cols-2">
          <CustomDatePicker
            value={referenceDate}
            onChange={setReferenceDate}
            placeholder="기준일"
            ariaLabel="기준일"
            className="w-full"
          />
        </SearchFieldGrid>
      </ManagerSearchSection>
      <ManagerGridSection
        headerLeft={(
          <>
            <GridPaginationControls page={page} totalPages={totalPages} pageInput={pageInput} setPageInput={setPageInput} goPrev={goPrev} goNext={goNext} goToPage={goToPage} disabled={loading} className="mt-0 justify-start" />
            <span className="text-xs text-muted-foreground">총 {totalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={changeSummary} />
          </>
        )}
        headerRight={<GridToolbarActions actions={toolbarActions} />}
        contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-0"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-border">
          <AgGridReact<RowData>
            theme="legacy"
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => String(params.data.employee_id)}
            animateRows={false}
            loading={loading}
            rowClassRules={rowClassRules}
            getRowClass={getRowClass}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate={`<span class="text-sm text-muted-foreground">${I18N.noRows}</span>`}
            headerHeight={36}
            rowHeight={34}
            onGridReady={(event: GridReadyEvent<RowData>) => { gridApiRef.current = event.api; }}
          />
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}
