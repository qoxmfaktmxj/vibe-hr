"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { Input } from "@/components/ui/input";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass } from "@/lib/grid/grid-status";
import { toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { OrgDeptChangeHistoryItem, OrgDeptChangeHistoryListResponse } from "@/types/organization";

// standard-v2 contract tokens
void toggleDeletedStatus;
void getGridRowClass;
void getGridStatusCellClass;

type DeptHistoryGridRow = OrgDeptChangeHistoryItem & {
  _status: "clean";
  _original?: Record<string, unknown>;
  _prevStatus?: "clean";
};

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지", more: "더보기", to: "~", of: "/",
  next: "다음", last: "마지막", first: "처음", previous: "이전",
  loadingOoo: "로딩 중...", noRowsToShow: "데이터가 없습니다.",
  searchOoo: "검색...", blanks: "(빈값)", filterOoo: "필터...",
  applyFilter: "적용", equals: "같음", notEqual: "같지 않음",
  contains: "포함", notContains: "미포함", startsWith: "시작", endsWith: "끝",
  andCondition: "그리고", orCondition: "또는",
  selectAll: "전체 선택", noMatches: "일치 항목 없음",
};

const FIELD_NAME_MAP: Record<string, string> = {
  code: "조직코드",
  name: "조직명",
  organization_type: "조직구분",
  cost_center_code: "코스트센터",
  parent_id: "상위조직",
  is_active: "사용여부",
};

function formatFieldName(field: string): string {
  return FIELD_NAME_MAP[field] ?? field;
}

export function OrgDeptHistoryManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/org/dept-history");
  const [rows, setRows] = useState<OrgDeptChangeHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [searchDeptId, setSearchDeptId] = useState("");
  const [searchLimit, setSearchLimit] = useState("200");
  const [appliedDeptId, setAppliedDeptId] = useState("");
  const [appliedLimit, setAppliedLimit] = useState("200");

  const gridApiRef = useRef<GridApi<OrgDeptChangeHistoryItem> | null>(null);

  const columnDefs = useMemo<ColDef<OrgDeptChangeHistoryItem>[]>(
    () => [
      {
        headerName: "No",
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
        width: 64,
        sortable: false,
        filter: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        pinned: "left",
      },
      {
        headerName: "부서명",
        field: "department_name",
        minWidth: 160,
        flex: 1.2,
        valueFormatter: (params) => params.value ?? `부서 ID: ${params.data?.department_id}`,
      },
      {
        headerName: "변경 필드",
        field: "field_name",
        width: 130,
        valueFormatter: (params) => formatFieldName(params.value as string),
      },
      {
        headerName: "변경 전",
        field: "before_value",
        flex: 1,
        minWidth: 140,
        valueFormatter: (params) => params.value ?? "-",
        cellClass: "text-slate-500",
      },
      {
        headerName: "변경 후",
        field: "after_value",
        flex: 1,
        minWidth: 140,
        valueFormatter: (params) => params.value ?? "-",
        cellClass: "font-medium",
      },
      {
        headerName: "변경자",
        field: "changed_by_name",
        width: 110,
        valueFormatter: (params) => params.value ?? `ID:${params.data?.changed_by ?? "-"}`,
      },
      {
        headerName: "사유",
        field: "change_reason",
        flex: 1.5,
        minWidth: 160,
        valueFormatter: (params) => params.value ?? "-",
      },
      {
        headerName: "변경 일시",
        field: "changed_at",
        minWidth: 180,
        sort: "desc",
        valueFormatter: (params) =>
          params.value ? new Date(params.value as string).toLocaleString("ko-KR") : "-",
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<OrgDeptChangeHistoryItem>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
      suppressMovable: true,
    }),
    [],
  );

  const fetchHistory = useCallback(async (deptId: string, limit: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deptId.trim()) params.set("department_id", deptId.trim());
      const parsedLimit = parseInt(limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) params.set("limit", String(parsedLimit));

      const url = params.size > 0 ? `/api/org/dept-history?${params.toString()}` : "/api/org/dept-history";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("이력을 불러오지 못했습니다.");
      const data = (await res.json()) as OrgDeptChangeHistoryListResponse;
      setRows(data.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이력 조회 실패");
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchHistory("", "200");
  }, [fetchHistory]);

  useEffect(() => {
    const api = gridApiRef.current;
    if (!api) return;
    if (loading) { api.showLoadingOverlay(); return; }
    if (rows.length === 0) { api.showNoRowsOverlay(); return; }
    api.hideOverlay();
  }, [loading, rows.length]);

  function handleQuery() {
    setAppliedDeptId(searchDeptId);
    setAppliedLimit(searchLimit);
    void fetchHistory(searchDeptId, searchLimit);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleQuery();
  }

  const onGridReady = useCallback((e: GridReadyEvent<OrgDeptChangeHistoryItem>) => {
    gridApiRef.current = e.api;
  }, []);

  const toolbarActions = [
    {
      key: "query",
      label: "조회",
      icon: Search,
      onClick: handleQuery,
      disabled: loading || menuActionLoading,
    },
  ].filter((action) => can(action.key));

  if (!initialLoaded && loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">이력 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection
        title="부서변경이력"
        onQuery={handleQuery}
        queryLabel="조회"
        queryDisabled={loading || menuActionLoading || !can("query")}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">부서 ID (미입력 시 전체)</div>
            <Input
              type="number"
              value={searchDeptId}
              onChange={(e) => setSearchDeptId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="부서 ID"
              className="h-9 w-36 text-sm"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">조회 건수</div>
            <Input
              type="number"
              value={searchLimit}
              onChange={(e) => setSearchLimit(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="200"
              className="h-9 w-28 text-sm"
            />
          </div>
        </div>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={
          <span className="text-xs text-slate-500">총 {rows.length.toLocaleString()}건</span>
        }
        headerRight={<GridToolbarActions actions={toolbarActions} />}
        contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-0"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<OrgDeptChangeHistoryItem>
            theme="legacy"
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => String(params.data.id)}
            animateRows={false}
            loading={loading}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate='<span class="text-sm text-slate-400">변경 이력이 없습니다.</span>'
            headerHeight={36}
            rowHeight={34}
            onGridReady={onGridReady}
          />
        </div>
      </ManagerGridSection>
    </ManagerPageShell>
  );
}
