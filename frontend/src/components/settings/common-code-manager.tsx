"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type RowClassParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Copy, Download, FileDown, Plus, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridToolbarActions, type GridToolbarAction } from "@/components/grid/grid-toolbar-actions";
import {
  ManagerGridSection,
  ManagerPageShell,
  ManagerSearchSection,
} from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import {
  buildGridRowClassRules,
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  CodeDetailResponse,
  CodeGroupDetailResponse,
  CodeGroupItem,
  CodeGroupListResponse,
  CodeItem,
  CodeListResponse,
} from "@/types/common-code";

type RowStatus = GridRowStatus;

type GroupRow = CodeGroupItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

type DetailRow = CodeItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: RowStatus;
};

type SearchFilters = {
  groupCode: string;
  groupName: string;
  detailCode: string;
  detailName: string;
};

type PendingAction =
  | { type: "query"; filters: SearchFilters }
  | { type: "groupPage"; page: number }
  | { type: "detailPage"; page: number }
  | { type: "selectGroup"; groupId: number };

const GROUP_TRACKED_FIELDS: (keyof CodeGroupItem)[] = [
  "code",
  "name",
  "description",
  "sort_order",
  "is_active",
];

const DETAIL_TRACKED_FIELDS: (keyof CodeItem)[] = [
  "code",
  "name",
  "description",
  "sort_order",
  "is_active",
  "extra_value1",
  "extra_value2",
];

const I18N = {
  title: "공통코드관리",
  groupTitle: "그룹코드마스터",
  detailTitle: "세부코드",
  loading: "공통코드 데이터를 불러오는 중...",
  loadGroupError: "그룹코드 목록을 불러오지 못했습니다.",
  loadDetailError: "세부코드 목록을 불러오지 못했습니다.",
  saveFailed: "저장에 실패했습니다.",
  saveDone: "저장이 완료되었습니다.",
  deleteBlocked: "현재 선택된 그룹의 세부코드 변경 사항을 먼저 저장해 주세요.",
  noGroupRows: "그룹코드 데이터가 없습니다.",
  noDetailRows: "세부코드 데이터가 없습니다.",
  query: "조회",
  add: "입력",
  copy: "복사",
  template: "양식 다운로드",
  upload: "업로드",
  download: "다운로드",
  save: "저장",
  copySuffix: " 복사",
  groupCodePlaceholder: "그룹코드",
  groupNamePlaceholder: "그룹코드명",
  detailCodePlaceholder: "세부코드",
  detailNamePlaceholder: "세부코드명",
  statusClean: "",
  statusAdded: "입력",
  statusUpdated: "수정",
  statusDeleted: "삭제",
  colDelete: "삭제",
  colStatus: "상태",
  colGroupCode: "그룹코드",
  colGroupName: "그룹코드명",
  colDescription: "설명",
  colSortOrder: "정렬순서",
  colActive: "사용",
  colUpdatedAt: "수정일시",
  colDetailCode: "세부코드",
  colDetailName: "세부코드명",
  colExtra1: "영문명",
  colExtra2: "비고1",
  colDetailDescription: "비고2",
  discardTitle: "저장되지 않은 변경 사항이 있습니다.",
  discardDescription:
    "현재 변경 내용을 저장하지 않고 이동하면 수정 내용이 사라집니다. 계속 진행하시겠습니까?",
  discardConfirm: "무시하고 이동",
  discardCancel: "취소",
};

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: I18N.statusClean,
  added: I18N.statusAdded,
  updated: I18N.statusUpdated,
  deleted: I18N.statusDeleted,
};

const DEFAULT_FILTERS: SearchFilters = {
  groupCode: "",
  groupName: "",
  detailCode: "",
  detailName: "",
};

const ACTION_CODE_BY_KEY: Record<string, string> = {
  create: "create",
  copy: "copy",
  template: "template_download",
  upload: "upload",
  download: "download",
  save: "save",
};

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

function buildGroupSnapshot(row: CodeGroupItem): Record<string, unknown> {
  return snapshotFields(row, GROUP_TRACKED_FIELDS);
}

function buildDetailSnapshot(row: CodeItem): Record<string, unknown> {
  return snapshotFields(row, DETAIL_TRACKED_FIELDS);
}

function toGroupRow(row: CodeGroupItem): GroupRow {
  return {
    ...row,
    _status: "clean",
    _original: buildGroupSnapshot(row),
  };
}

function toDetailRow(row: CodeItem): DetailRow {
  return {
    ...row,
    _status: "clean",
    _original: buildDetailSnapshot(row),
  };
}

function isGroupRowReverted(row: GroupRow): boolean {
  return isRowRevertedToOriginal(row, GROUP_TRACKED_FIELDS);
}

function isDetailRowReverted(row: DetailRow): boolean {
  return isRowRevertedToOriginal(row, DETAIL_TRACKED_FIELDS);
}

function parseError(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  if (typeof record.detail === "string" && record.detail.trim()) return record.detail;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return fallback;
}

async function fetchJson<T>(input: RequestInfo, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as T | { detail?: string; message?: string } | null;
  if (!response.ok) {
    throw new Error(parseError(data, fallback));
  }
  return data as T;
}

function createEmptyGroupRow(id: number): GroupRow {
  const now = new Date().toISOString();
  return {
    id,
    code: "",
    name: "",
    description: "",
    sort_order: 0,
    is_active: true,
    created_at: now,
    updated_at: now,
    _status: "added",
  };
}

function createCopiedGroupRow(source: GroupRow, id: number): GroupRow {
  const now = new Date().toISOString();
  return {
    ...source,
    id,
    code: `${source.code}_COPY`,
    name: `${source.name}${I18N.copySuffix}`,
    created_at: now,
    updated_at: now,
    _status: "added",
    _original: undefined,
    _prevStatus: undefined,
  };
}

function createEmptyDetailRow(id: number, groupId: number): DetailRow {
  const now = new Date().toISOString();
  return {
    id,
    group_id: groupId,
    code: "",
    name: "",
    description: "",
    sort_order: 0,
    is_active: true,
    extra_value1: "",
    extra_value2: "",
    created_at: now,
    updated_at: now,
    _status: "added",
  };
}

function createCopiedDetailRow(source: DetailRow, id: number, groupId: number): DetailRow {
  const now = new Date().toISOString();
  return {
    ...source,
    id,
    group_id: groupId,
    code: `${source.code}_COPY`,
    name: `${source.name}${I18N.copySuffix}`,
    created_at: now,
    updated_at: now,
    _status: "added",
    _original: undefined,
    _prevStatus: undefined,
  };
}

function buildGroupListUrl(filters: SearchFilters, page: number, limit: number): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters.groupCode.trim()) params.set("code", filters.groupCode.trim());
  if (filters.groupName.trim()) params.set("name", filters.groupName.trim());
  return `/api/codes/groups?${params.toString()}`;
}

function buildDetailListUrl(filters: SearchFilters, groupId: number, page: number, limit: number): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters.detailCode.trim()) params.set("code", filters.detailCode.trim());
  if (filters.detailName.trim()) params.set("name", filters.detailName.trim());
  return `/api/codes/groups/${groupId}/items?${params.toString()}`;
}

function normalizeNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CommonCodeManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/settings/common-codes");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [groupPage, setGroupPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);
  const [groupPageSize] = useState(50);
  const [detailPageSize] = useState(50);
  const [groupTotalCount, setGroupTotalCount] = useState(0);
  const [detailTotalCount, setDetailTotalCount] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [groupSaving, setGroupSaving] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [groupReloadKey, setGroupReloadKey] = useState(0);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [groupSelectionHint, setGroupSelectionHint] = useState<number | null | undefined>(undefined);
  const [detailSelectionHint, setDetailSelectionHint] = useState<number | null | undefined>(undefined);

  const tempGroupIdRef = useRef(-1);
  const tempDetailIdRef = useRef(-1);
  const groupGridApiRef = useRef<GridApi<GroupRow> | null>(null);
  const detailGridApiRef = useRef<GridApi<DetailRow> | null>(null);
  const groupRowsRef = useRef<GroupRow[]>([]);
  const detailRowsRef = useRef<DetailRow[]>([]);
  const selectedGroupIdRef = useRef<number | null>(null);
  const selectedDetailIdRef = useRef<number | null>(null);
  const groupFetchIdRef = useRef(0);
  const detailFetchIdRef = useRef(0);

  const selectedGroup = useMemo(
    () => groupRows.find((row) => row.id === selectedGroupId) ?? null,
    [groupRows, selectedGroupId],
  );
  const selectedDetail = useMemo(
    () => detailRows.find((row) => row.id === selectedDetailId) ?? null,
    [detailRows, selectedDetailId],
  );

  const groupSummary = useMemo(
    () => summarizeGridStatuses(groupRows, (row) => row._status),
    [groupRows],
  );
  const detailSummary = useMemo(
    () => summarizeGridStatuses(detailRows, (row) => row._status),
    [detailRows],
  );
  const hasDirtyGroupRows = useMemo(
    () => groupRows.some((row) => row._status !== "clean"),
    [groupRows],
  );
  const hasDirtyDetailRows = useMemo(
    () => detailRows.some((row) => row._status !== "clean"),
    [detailRows],
  );

  useEffect(() => {
    groupRowsRef.current = groupRows;
  }, [groupRows]);

  useEffect(() => {
    detailRowsRef.current = detailRows;
  }, [detailRows]);

  useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId;
  }, [selectedGroupId]);

  useEffect(() => {
    selectedDetailIdRef.current = selectedDetailId;
  }, [selectedDetailId]);

  const commitGroupRows = useCallback((updater: (rows: GroupRow[]) => GroupRow[]) => {
    setGroupRows((prev) => {
      const next = updater(prev);
      groupRowsRef.current = next;
      return next;
    });
  }, []);

  const commitDetailRows = useCallback((updater: (rows: DetailRow[]) => DetailRow[]) => {
    setDetailRows((prev) => {
      const next = updater(prev);
      detailRowsRef.current = next;
      return next;
    });
  }, []);

  const defaultGroupColDef = useMemo<ColDef<GroupRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
      suppressMovable: true,
      minWidth: 100,
    }),
    [],
  );
  const defaultDetailColDef = useMemo<ColDef<DetailRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
      suppressMovable: true,
      minWidth: 100,
    }),
    [],
  );

  const toggleGroupDelete = useCallback(
    (rowId: number, checked: boolean) => {
      commitGroupRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isGroupRowReverted(candidate),
        }),
      );
    },
    [commitGroupRows],
  );

  const toggleDetailDelete = useCallback(
    (rowId: number, checked: boolean) => {
      commitDetailRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isDetailRowReverted(candidate),
        }),
      );
    },
    [commitDetailRows],
  );

  const groupColumnDefs = useMemo<ColDef<GroupRow>[]>(
    () => [
      {
        headerName: I18N.colDelete,
        width: 56,
        pinned: "left",
        sortable: false,
        filter: false,
        editable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: ICellRendererParams<GroupRow>) => {
          const row = params.data;
          if (!row) return null;
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={row._status === "deleted"}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)]"
                onChange={(event) => toggleGroupDelete(row.id, event.target.checked)}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          );
        },
      },
      {
        headerName: I18N.colStatus,
        field: "_status",
        width: 72,
        editable: false,
        sortable: false,
        filter: false,
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
      },
      {
        headerName: I18N.colGroupCode,
        field: "code",
        minWidth: 150,
        flex: 1,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colGroupName,
        field: "name",
        minWidth: 180,
        flex: 1.2,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colDescription,
        field: "description",
        minWidth: 180,
        flex: 1.3,
        editable: (params) => params.data?._status !== "deleted",
        valueFormatter: (params) => String(params.value ?? ""),
      },
      {
        headerName: I18N.colSortOrder,
        field: "sort_order",
        width: 110,
        editable: (params) => params.data?._status !== "deleted",
        valueParser: (params) => normalizeNumber(params.newValue),
      },
      {
        headerName: I18N.colActive,
        field: "is_active",
        width: 90,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (params) => (params.value ? "Y" : "N"),
        valueParser: (params) => params.newValue === "Y",
      },
      {
        headerName: I18N.colUpdatedAt,
        field: "updated_at",
        minWidth: 170,
        editable: false,
        valueFormatter: (params) =>
          params.value ? new Date(String(params.value)).toLocaleString() : "",
      },
    ],
    [toggleGroupDelete],
  );

  const detailColumnDefs = useMemo<ColDef<DetailRow>[]>(
    () => [
      {
        headerName: I18N.colDelete,
        width: 56,
        pinned: "left",
        sortable: false,
        filter: false,
        editable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: ICellRendererParams<DetailRow>) => {
          const row = params.data;
          if (!row) return null;
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={row._status === "deleted"}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)]"
                onChange={(event) => toggleDetailDelete(row.id, event.target.checked)}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          );
        },
      },
      {
        headerName: I18N.colStatus,
        field: "_status",
        width: 72,
        editable: false,
        sortable: false,
        filter: false,
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
        cellClass: (params) => getGridStatusCellClass(params.value as RowStatus),
      },
      {
        headerName: I18N.colDetailCode,
        field: "code",
        minWidth: 150,
        flex: 1,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colDetailName,
        field: "name",
        minWidth: 180,
        flex: 1.2,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colDescription,
        field: "description",
        minWidth: 170,
        flex: 1.1,
        editable: (params) => params.data?._status !== "deleted",
        valueFormatter: (params) => String(params.value ?? ""),
      },
      {
        headerName: I18N.colExtra1,
        field: "extra_value1",
        minWidth: 160,
        flex: 1,
        editable: (params) => params.data?._status !== "deleted",
        valueFormatter: (params) => String(params.value ?? ""),
      },
      {
        headerName: I18N.colExtra2,
        field: "extra_value2",
        minWidth: 160,
        flex: 1,
        editable: (params) => params.data?._status !== "deleted",
        valueFormatter: (params) => String(params.value ?? ""),
      },
      {
        headerName: I18N.colSortOrder,
        field: "sort_order",
        width: 110,
        editable: (params) => params.data?._status !== "deleted",
        valueParser: (params) => normalizeNumber(params.newValue),
      },
      {
        headerName: I18N.colActive,
        field: "is_active",
        width: 90,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (params) => (params.value ? "Y" : "N"),
        valueParser: (params) => params.newValue === "Y",
      },
      {
        headerName: I18N.colUpdatedAt,
        field: "updated_at",
        minWidth: 170,
        editable: false,
        valueFormatter: (params) =>
          params.value ? new Date(String(params.value)).toLocaleString() : "",
      },
    ],
    [toggleDetailDelete],
  );

  const groupRowClassRules = useMemo(() => buildGridRowClassRules<GroupRow>(), []);
  const detailRowClassRules = useMemo(() => buildGridRowClassRules<DetailRow>(), []);
  const getGroupRowClass = useCallback(
    (params: RowClassParams<GroupRow>) => getGridRowClass(params.data?._status),
    [],
  );
  const getDetailRowClass = useCallback(
    (params: RowClassParams<DetailRow>) => getGridRowClass(params.data?._status),
    [],
  );

  const fetchGroups = useCallback(
    async (filters: SearchFilters, page: number) =>
      fetchJson<CodeGroupListResponse>(
        buildGroupListUrl(filters, page, groupPageSize),
        { cache: "no-store" },
        I18N.loadGroupError,
      ),
    [groupPageSize],
  );

  const fetchDetails = useCallback(
    async (filters: SearchFilters, groupId: number, page: number) =>
      fetchJson<CodeListResponse>(
        buildDetailListUrl(filters, groupId, page, detailPageSize),
        { cache: "no-store" },
        I18N.loadDetailError,
      ),
    [detailPageSize],
  );

  useEffect(() => {
    let cancelled = false;
    const requestId = ++groupFetchIdRef.current;

    async function load() {
      setGroupLoading(true);
      try {
        const data = await fetchGroups(appliedFilters, groupPage);
        if (cancelled || requestId !== groupFetchIdRef.current) return;

        const nextRows = data.groups.map(toGroupRow);
        const preferredId =
          groupSelectionHint !== undefined ? groupSelectionHint : selectedGroupIdRef.current;
        const nextSelectedId =
          preferredId != null && nextRows.some((row) => row.id === preferredId)
            ? preferredId
            : (nextRows[0]?.id ?? null);

        groupRowsRef.current = nextRows;
        setGroupRows(nextRows);
        setGroupTotalCount(data.total_count ?? nextRows.length);
        setSelectedGroupId(nextSelectedId);
        setSelectedDetailId(null);
        setGroupSelectionHint(undefined);
        setInitialLoading(false);
      } catch (error) {
        if (cancelled || requestId !== groupFetchIdRef.current) return;
        setInitialLoading(false);
        toast.error(error instanceof Error ? error.message : I18N.loadGroupError);
      } finally {
        if (!cancelled && requestId === groupFetchIdRef.current) {
          setGroupLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [appliedFilters, fetchGroups, groupPage, groupReloadKey, groupSelectionHint]);

  useEffect(() => {
    if (!selectedGroupId) {
      detailRowsRef.current = [];
      setDetailRows([]);
      setDetailTotalCount(0);
      setSelectedDetailId(null);
      setDetailLoading(false);
      setInitialLoading(false);
      return;
    }

    let cancelled = false;
    const requestId = ++detailFetchIdRef.current;
    const activeGroupId = selectedGroupId;

    async function load() {
      setDetailLoading(true);
      try {
        const data = await fetchDetails(appliedFilters, activeGroupId, detailPage);
        if (cancelled || requestId !== detailFetchIdRef.current) return;

        const nextRows = data.codes.map(toDetailRow);
        const preferredId =
          detailSelectionHint !== undefined ? detailSelectionHint : selectedDetailIdRef.current;
        const nextSelectedId =
          preferredId != null && nextRows.some((row) => row.id === preferredId)
            ? preferredId
            : (nextRows[0]?.id ?? null);

        detailRowsRef.current = nextRows;
        setDetailRows(nextRows);
        setDetailTotalCount(data.total_count ?? nextRows.length);
        setSelectedDetailId(nextSelectedId);
        setDetailSelectionHint(undefined);
      } catch (error) {
        if (cancelled || requestId !== detailFetchIdRef.current) return;
        toast.error(error instanceof Error ? error.message : I18N.loadDetailError);
      } finally {
        if (!cancelled && requestId === detailFetchIdRef.current) {
          setDetailLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [appliedFilters, detailPage, detailReloadKey, detailSelectionHint, fetchDetails, selectedGroupId]);

  useEffect(() => {
    const api = groupGridApiRef.current;
    if (!api) return;
    api.forEachNode((node) => {
      node.setSelected(node.data?.id === selectedGroupId);
    });
  }, [groupRows, selectedGroupId]);

  useEffect(() => {
    const api = detailGridApiRef.current;
    if (!api) return;
    api.forEachNode((node) => {
      node.setSelected(node.data?.id === selectedDetailId);
    });
  }, [detailRows, selectedDetailId]);

  const handleGroupCellValueChanged = useCallback(
    (event: CellValueChangedEvent<GroupRow>) => {
      if (!event.data || event.newValue === event.oldValue) return;
      const rowId = event.data.id;
      const field = event.colDef.field as keyof GroupRow | undefined;
      if (!field) return;

      commitGroupRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const next = { ...row };

          if (field === "code" || field === "name") {
            next[field] = String(event.newValue ?? "").trim();
          } else if (field === "description") {
            next.description = normalizeNullableText(event.newValue);
          } else if (field === "sort_order") {
            next.sort_order = normalizeNumber(event.newValue);
          } else if (field === "is_active") {
            next.is_active = Boolean(event.newValue);
          }

          return reconcileUpdatedStatus(next, {
            shouldBeClean: (candidate) => isGroupRowReverted(candidate),
          });
        }),
      );
    },
    [commitGroupRows],
  );

  const handleDetailCellValueChanged = useCallback(
    (event: CellValueChangedEvent<DetailRow>) => {
      if (!event.data || event.newValue === event.oldValue) return;
      const rowId = event.data.id;
      const field = event.colDef.field as keyof DetailRow | undefined;
      if (!field) return;

      commitDetailRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const next = { ...row };

          if (field === "code" || field === "name") {
            next[field] = String(event.newValue ?? "").trim();
          } else if (field === "description") {
            next.description = normalizeNullableText(event.newValue);
          } else if (field === "extra_value1") {
            next.extra_value1 = normalizeNullableText(event.newValue);
          } else if (field === "extra_value2") {
            next.extra_value2 = normalizeNullableText(event.newValue);
          } else if (field === "sort_order") {
            next.sort_order = normalizeNumber(event.newValue);
          } else if (field === "is_active") {
            next.is_active = Boolean(event.newValue);
          }

          return reconcileUpdatedStatus(next, {
            shouldBeClean: (candidate) => isDetailRowReverted(candidate),
          });
        }),
      );
    },
    [commitDetailRows],
  );

  const executeAction = useCallback(
    (action: PendingAction, force = false) => {
      groupGridApiRef.current?.stopEditing();
      detailGridApiRef.current?.stopEditing();

      const needsDetailProtection =
        action.type === "detailPage" || action.type === "selectGroup";
      const hasDirtyRows = needsDetailProtection
        ? hasDirtyDetailRows
        : hasDirtyGroupRows || hasDirtyDetailRows;

      if (hasDirtyRows && !force) {
        setPendingAction(action);
        setDiscardDialogOpen(true);
        return;
      }

      if (action.type === "query") {
        setAppliedFilters({ ...action.filters });
        setGroupPage(1);
        setDetailPage(1);
        setGroupSelectionHint(selectedGroupIdRef.current);
        setDetailSelectionHint(selectedDetailIdRef.current);
        return;
      }

      if (action.type === "groupPage") {
        setGroupPage(action.page);
        setGroupSelectionHint(selectedGroupIdRef.current);
        return;
      }

      if (action.type === "detailPage") {
        setDetailPage(action.page);
        setDetailSelectionHint(selectedDetailIdRef.current);
        return;
      }

      if (selectedGroupIdRef.current === action.groupId) return;
      setSelectedGroupId(action.groupId);
      setSelectedDetailId(null);
      setDetailPage(1);
      setDetailSelectionHint(undefined);
    },
    [hasDirtyDetailRows, hasDirtyGroupRows],
  );

  const handleDiscardAndContinue = useCallback(() => {
    if (!pendingAction) return;
    setDiscardDialogOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    executeAction(action, true);
  }, [executeAction, pendingAction]);

  const handleSearchEnter = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      executeAction({ type: "query", filters: searchFilters });
    },
    [executeAction, searchFilters],
  );

  const groupPagination = useGridPagination({
    page: groupPage,
    totalCount: groupTotalCount,
    pageSize: groupPageSize,
    onPageChange: (page) => executeAction({ type: "groupPage", page }),
  });
  const detailPagination = useGridPagination({
    page: detailPage,
    totalCount: detailTotalCount,
    pageSize: detailPageSize,
    onPageChange: (page) => executeAction({ type: "detailPage", page }),
  });

  const filterToolbarActions = useCallback(
    (actions: GridToolbarAction[]) =>
      actions
        .filter((action) => can(ACTION_CODE_BY_KEY[action.key] ?? action.key))
        .map((action) => ({ ...action, disabled: Boolean(action.disabled) || menuActionLoading })),
    [can, menuActionLoading],
  );

  function addGroupRow() {
    const nextId = tempGroupIdRef.current;
    tempGroupIdRef.current -= 1;
    const row = createEmptyGroupRow(nextId);
    commitGroupRows((prev) => [row, ...prev]);
    setSelectedGroupId(nextId);
  }

  function copyGroupRow() {
    if (!selectedGroup) return;
    const nextId = tempGroupIdRef.current;
    tempGroupIdRef.current -= 1;
    const row = createCopiedGroupRow(selectedGroup, nextId);
    commitGroupRows((prev) => [row, ...prev]);
    setSelectedGroupId(nextId);
  }

  function addDetailRow() {
    if (!selectedGroupId) return;
    const nextId = tempDetailIdRef.current;
    tempDetailIdRef.current -= 1;
    const row = createEmptyDetailRow(nextId, selectedGroupId);
    commitDetailRows((prev) => [row, ...prev]);
    setSelectedDetailId(nextId);
  }

  function copyDetailRow() {
    if (!selectedGroupId || !selectedDetail) return;
    const nextId = tempDetailIdRef.current;
    tempDetailIdRef.current -= 1;
    const row = createCopiedDetailRow(selectedDetail, nextId, selectedGroupId);
    commitDetailRows((prev) => [row, ...prev]);
    setSelectedDetailId(nextId);
  }

  function handleTemplateDownload(scope: "group" | "detail") {
    toast.info(
      `${scope === "group" ? I18N.groupTitle : I18N.detailTitle} ${I18N.template}는 다음 단계에서 연결합니다.`,
    );
  }

  function handleUpload(scope: "group" | "detail") {
    toast.info(
      `${scope === "group" ? I18N.groupTitle : I18N.detailTitle} ${I18N.upload}는 다음 단계에서 연결합니다.`,
    );
  }

  async function saveGroups() {
    if (groupSaving) return;
    groupGridApiRef.current?.stopEditing();
    detailGridApiRef.current?.stopEditing();

    const deletingSelectedGroup =
      selectedGroupIdRef.current != null &&
      groupRowsRef.current.some(
        (row) => row.id === selectedGroupIdRef.current && row._status === "deleted",
      );

    if (deletingSelectedGroup && hasDirtyDetailRows) {
      toast.error(I18N.deleteBlocked);
      return;
    }

    const toInsert = groupRowsRef.current.filter((row) => row._status === "added");
    const toUpdate = groupRowsRef.current.filter((row) => row._status === "updated");
    const toDelete = groupRowsRef.current.filter((row) => row._status === "deleted");

    if (toInsert.length + toUpdate.length + toDelete.length === 0) {
      toast.info("저장할 그룹코드 변경 사항이 없습니다.");
      return;
    }

    setGroupSaving(true);
    try {
      let preferredSelectedId = selectedGroupIdRef.current;

      for (const row of toInsert) {
        const data = await fetchJson<CodeGroupDetailResponse>(
          "/api/codes/groups",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: row.code.trim(),
              name: row.name.trim(),
              description: normalizeNullableText(row.description),
              sort_order: row.sort_order,
              is_active: row.is_active,
            }),
          },
          I18N.saveFailed,
        );
        if (row.id === selectedGroupIdRef.current) {
          preferredSelectedId = data.group.id;
        }
      }

      for (const row of toUpdate) {
        await fetchJson<CodeGroupDetailResponse>(
          `/api/codes/groups/${row.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: row.code.trim(),
              name: row.name.trim(),
              description: normalizeNullableText(row.description),
              sort_order: row.sort_order,
              is_active: row.is_active,
            }),
          },
          I18N.saveFailed,
        );
      }

      for (const row of toDelete) {
        await fetch(`/api/codes/groups/${row.id}`, { method: "DELETE" }).then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(parseError(data, I18N.saveFailed));
          }
        });
        if (row.id === preferredSelectedId) {
          preferredSelectedId = null;
        }
      }

      setGroupSelectionHint(preferredSelectedId);
      setGroupReloadKey((prev) => prev + 1);
      setDetailReloadKey((prev) => prev + 1);
      toast.success(
        `${I18N.saveDone} (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.saveFailed);
    } finally {
      setGroupSaving(false);
    }
  }

  async function saveDetails() {
    if (!selectedGroupId || detailSaving) return;
    detailGridApiRef.current?.stopEditing();

    const toInsert = detailRowsRef.current.filter((row) => row._status === "added");
    const toUpdate = detailRowsRef.current.filter((row) => row._status === "updated");
    const toDelete = detailRowsRef.current.filter((row) => row._status === "deleted");

    if (toInsert.length + toUpdate.length + toDelete.length === 0) {
      toast.info("저장할 세부코드 변경 사항이 없습니다.");
      return;
    }

    setDetailSaving(true);
    try {
      let preferredSelectedId = selectedDetailIdRef.current;

      for (const row of toInsert) {
        const data = await fetchJson<CodeDetailResponse>(
          `/api/codes/groups/${selectedGroupId}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: row.code.trim(),
              name: row.name.trim(),
              description: normalizeNullableText(row.description),
              sort_order: row.sort_order,
              is_active: row.is_active,
              extra_value1: normalizeNullableText(row.extra_value1),
              extra_value2: normalizeNullableText(row.extra_value2),
            }),
          },
          I18N.saveFailed,
        );
        if (row.id === selectedDetailIdRef.current) {
          preferredSelectedId = data.code.id;
        }
      }

      for (const row of toUpdate) {
        await fetchJson<CodeDetailResponse>(
          `/api/codes/groups/${selectedGroupId}/items/${row.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: row.code.trim(),
              name: row.name.trim(),
              description: normalizeNullableText(row.description),
              sort_order: row.sort_order,
              is_active: row.is_active,
              extra_value1: normalizeNullableText(row.extra_value1),
              extra_value2: normalizeNullableText(row.extra_value2),
            }),
          },
          I18N.saveFailed,
        );
      }

      for (const row of toDelete) {
        await fetch(`/api/codes/groups/${selectedGroupId}/items/${row.id}`, {
          method: "DELETE",
        }).then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(parseError(data, I18N.saveFailed));
          }
        });
        if (row.id === preferredSelectedId) {
          preferredSelectedId = null;
        }
      }

      setDetailSelectionHint(preferredSelectedId);
      setDetailReloadKey((prev) => prev + 1);
      toast.success(
        `${I18N.saveDone} (입력 ${toInsert.length}건 / 수정 ${toUpdate.length}건 / 삭제 ${toDelete.length}건)`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : I18N.saveFailed);
    } finally {
      setDetailSaving(false);
    }
  }

  const groupToolbarActions = filterToolbarActions([
    {
      key: "create",
      label: I18N.add,
      icon: Plus,
      onClick: addGroupRow,
      disabled: groupSaving || groupLoading,
    },
    {
      key: "copy",
      label: I18N.copy,
      icon: Copy,
      onClick: copyGroupRow,
      disabled: groupSaving || !selectedGroup,
    },
    {
      key: "template",
      label: I18N.template,
      icon: FileDown,
      onClick: () => handleTemplateDownload("group"),
      disabled: groupSaving,
    },
    {
      key: "upload",
      label: I18N.upload,
      icon: Upload,
      onClick: () => handleUpload("group"),
      disabled: groupSaving,
    },
    {
      key: "download",
      label: I18N.download,
      icon: Download,
      onClick: () => groupGridApiRef.current?.exportDataAsCsv({ fileName: "common-code-groups.csv" }),
      disabled: groupLoading || groupRows.length === 0,
    },
  ]);

  const detailToolbarActions = filterToolbarActions([
    {
      key: "create",
      label: I18N.add,
      icon: Plus,
      onClick: addDetailRow,
      disabled: detailSaving || !selectedGroupId,
    },
    {
      key: "copy",
      label: I18N.copy,
      icon: Copy,
      onClick: copyDetailRow,
      disabled: detailSaving || !selectedDetail,
    },
    {
      key: "template",
      label: I18N.template,
      icon: FileDown,
      onClick: () => handleTemplateDownload("detail"),
      disabled: detailSaving || !selectedGroupId,
    },
    {
      key: "upload",
      label: I18N.upload,
      icon: Upload,
      onClick: () => handleUpload("detail"),
      disabled: detailSaving || !selectedGroupId,
    },
    {
      key: "download",
      label: I18N.download,
      icon: Download,
      onClick: () => detailGridApiRef.current?.exportDataAsCsv({ fileName: "common-code-details.csv" }),
      disabled: detailLoading || detailRows.length === 0 || !selectedGroupId,
    },
  ]);

  const groupSaveAction = can("save")
    ? {
        key: "save",
        label: I18N.save,
        icon: Save,
        onClick: () => void saveGroups(),
        disabled: groupSaving || menuActionLoading,
      }
    : undefined;

  const detailSaveAction = can("save")
    ? {
        key: "save",
        label: I18N.save,
        icon: Save,
        onClick: () => void saveDetails(),
        disabled: detailSaving || menuActionLoading || !selectedGroupId,
      }
    : undefined;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">{I18N.loading}</p>
      </div>
    );
  }

  return (
    <ManagerPageShell>
      <ManagerSearchSection
        title={I18N.title}
        onQuery={() => executeAction({ type: "query", filters: searchFilters })}
        queryDisabled={groupLoading || detailLoading || groupSaving || detailSaving || !can("query")}
      >
        <SearchFieldGrid className="xl:grid-cols-4">
          <SearchTextField
            value={searchFilters.groupCode}
            placeholder={I18N.groupCodePlaceholder}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, groupCode: value }))}
            onKeyDown={handleSearchEnter}
          />
          <SearchTextField
            value={searchFilters.groupName}
            placeholder={I18N.groupNamePlaceholder}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, groupName: value }))}
            onKeyDown={handleSearchEnter}
          />
          <SearchTextField
            value={searchFilters.detailCode}
            placeholder={I18N.detailCodePlaceholder}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, detailCode: value }))}
            onKeyDown={handleSearchEnter}
          />
          <SearchTextField
            value={searchFilters.detailName}
            placeholder={I18N.detailNamePlaceholder}
            onChange={(value) => setSearchFilters((prev) => ({ ...prev, detailName: value }))}
            onKeyDown={handleSearchEnter}
          />
        </SearchFieldGrid>
      </ManagerSearchSection>

      <ManagerGridSection
        className="min-h-0 flex-[1.05]"
        headerLeft={
          <>
            <GridPaginationControls
              page={groupPage}
              totalPages={groupPagination.totalPages}
              pageInput={groupPagination.pageInput}
              setPageInput={groupPagination.setPageInput}
              goPrev={groupPagination.goPrev}
              goNext={groupPagination.goNext}
              goToPage={groupPagination.goToPage}
              disabled={groupLoading || groupSaving}
              className="mt-0 justify-start"
            />
            <span className="text-xs text-slate-500">총 {groupTotalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={groupSummary} />
          </>
        }
        headerRight={
          <>
            <div className="mr-2 text-sm font-semibold text-slate-700">{I18N.groupTitle}</div>
            <GridToolbarActions actions={groupToolbarActions} saveAction={groupSaveAction} />
          </>
        }
        contentClassName="min-h-0 flex-1 px-6 pb-4"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<GroupRow>
            theme="legacy"
            rowData={groupRows}
            columnDefs={groupColumnDefs}
            defaultColDef={defaultGroupColDef}
            rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
            rowClassRules={groupRowClassRules}
            getRowClass={getGroupRowClass}
            getRowId={(params) => String(params.data.id)}
            onGridReady={(event: GridReadyEvent<GroupRow>) => {
              groupGridApiRef.current = event.api;
            }}
            onRowClicked={(event) => {
              if (!event.data) return;
              executeAction({ type: "selectGroup", groupId: event.data.id });
            }}
            onCellValueChanged={handleGroupCellValueChanged}
            singleClickEdit={true}
            loading={groupLoading}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate={`<span class="text-sm text-slate-400">${I18N.noGroupRows}</span>`}
            headerHeight={36}
            rowHeight={34}
          />
        </div>
      </ManagerGridSection>

      <ManagerGridSection
        className="min-h-0 flex-1"
        headerLeft={
          <>
            <GridPaginationControls
              page={detailPage}
              totalPages={detailPagination.totalPages}
              pageInput={detailPagination.pageInput}
              setPageInput={detailPagination.setPageInput}
              goPrev={detailPagination.goPrev}
              goNext={detailPagination.goNext}
              goToPage={detailPagination.goToPage}
              disabled={detailLoading || detailSaving || !selectedGroupId}
              className="mt-0 justify-start"
            />
            <span className="text-xs text-slate-500">총 {detailTotalCount.toLocaleString()}건</span>
            <GridChangeSummaryBadges summary={detailSummary} />
          </>
        }
        headerRight={
          <>
            <div className="mr-2 text-sm font-semibold text-slate-700">
              {selectedGroup ? `${I18N.detailTitle} · ${selectedGroup.name}` : I18N.detailTitle}
            </div>
            <GridToolbarActions actions={detailToolbarActions} saveAction={detailSaveAction} />
          </>
        }
        contentClassName="min-h-0 flex-1 px-6 pb-4"
      >
        <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
          <AgGridReact<DetailRow>
            theme="legacy"
            rowData={detailRows}
            columnDefs={detailColumnDefs}
            defaultColDef={defaultDetailColDef}
            rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
            rowClassRules={detailRowClassRules}
            getRowClass={getDetailRowClass}
            getRowId={(params) => String(params.data.id)}
            onGridReady={(event: GridReadyEvent<DetailRow>) => {
              detailGridApiRef.current = event.api;
            }}
            onRowClicked={(event) => {
              if (!event.data) return;
              setSelectedDetailId(event.data.id);
            }}
            onCellValueChanged={handleDetailCellValueChanged}
            singleClickEdit={true}
            loading={detailLoading}
            localeText={AG_GRID_LOCALE_KO}
            overlayNoRowsTemplate={`<span class="text-sm text-slate-400">${I18N.noDetailRows}</span>`}
            headerHeight={36}
            rowHeight={34}
          />
        </div>
      </ManagerGridSection>

      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={(open) => {
          setDiscardDialogOpen(open);
          if (!open) setPendingAction(null);
        }}
        title={I18N.discardTitle}
        description={I18N.discardDescription}
        confirmLabel={I18N.discardConfirm}
        cancelLabel={I18N.discardCancel}
        confirmVariant="destructive"
        onConfirm={handleDiscardAndContinue}
      />
    </ManagerPageShell>
  );
}
