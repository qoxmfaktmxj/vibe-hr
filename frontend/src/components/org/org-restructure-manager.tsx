"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Plus, Trash2, Play, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { ManagerPageShell } from "@/components/grid/manager-layout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildGridRowClassRules,
  getGridRowClass,
  getGridStatusCellClass,
  summarizeGridStatuses,
} from "@/lib/grid/grid-status";
import {
  reconcileUpdatedStatus,
  toggleDeletedStatus,
} from "@/lib/grid/grid-status-mutations";
import {
  isRowRevertedToOriginal,
  snapshotFields,
  type GridRowStatus,
} from "@/lib/hr/grid-change-tracker";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  OrgRestructureActionType,
  OrgRestructureApplyResponse,
  OrgRestructurePlanItem,
  OrgRestructurePlanItemDetail,
  OrgRestructurePlanItemListResponse,
  OrgRestructurePlanListResponse,
  OrgRestructurePlanStatus,
} from "@/types/organization";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RowStatus = GridRowStatus;

type PlanRow = OrgRestructurePlanItem & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
};

type ItemRow = OrgRestructurePlanItemDetail & {
  _status: RowStatus;
  _original?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_LABELS: Record<RowStatus, string> = {
  clean: "", added: "입력", updated: "수정", deleted: "삭제",
};

const PLAN_STATUS_LABELS: Record<OrgRestructurePlanStatus, string> = {
  draft: "초안",
  reviewing: "검토중",
  applied: "적용됨",
  cancelled: "취소됨",
};


const ACTION_TYPE_LABELS: Record<OrgRestructureActionType, string> = {
  move: "이동",
  rename: "이름변경",
  create: "신설",
  deactivate: "비활성화",
  reactivate: "재활성화",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  applied: "적용",
  skipped: "건너뜀",
};

const PLAN_TRACKED_FIELDS: (keyof OrgRestructurePlanItem)[] = ["title", "description", "planned_date", "status"];
const ITEM_TRACKED_FIELDS: (keyof OrgRestructurePlanItemDetail)[] = [
  "action_type", "target_dept_id", "new_parent_id", "new_name", "new_code",
  "new_organization_type", "new_cost_center_code", "sort_order", "memo",
];

const ACTION_TYPE_OPTIONS = ["move", "rename", "create", "deactivate", "reactivate"];
const PLAN_STATUS_OPTIONS = ["draft", "reviewing", "applied", "cancelled"];

const AG_GRID_LOCALE_KO: Record<string, string> = {
  loadingOoo: "로딩 중...", noRowsToShow: "데이터가 없습니다.",
  page: "페이지", to: "~", of: "/", next: "다음", previous: "이전",
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------
function toPlanRow(item: OrgRestructurePlanItem): PlanRow {
  return {
    ...item,
    _status: "clean",
    _original: snapshotFields(item, PLAN_TRACKED_FIELDS),
  };
}

function toItemRow(item: OrgRestructurePlanItemDetail): ItemRow {
  return {
    ...item,
    _status: "clean",
    _original: snapshotFields(item, ITEM_TRACKED_FIELDS),
  };
}

function isPlanReverted(row: PlanRow): boolean {
  return isRowRevertedToOriginal(row, PLAN_TRACKED_FIELDS);
}

function isItemReverted(row: ItemRow): boolean {
  return isRowRevertedToOriginal(row, ITEM_TRACKED_FIELDS);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function OrgRestructureManager() {
  const { can, loading: menuActionLoading } = useMenuActions("/org/restructure");

  // Plans state
  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [planSaving, setPlanSaving] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const planGridApiRef = useRef<GridApi<PlanRow> | null>(null);
  const planRowsRef = useRef<PlanRow[]>([]);
  const planTempIdRef = useRef(-1);

  // Items state
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const itemGridApiRef = useRef<GridApi<ItemRow> | null>(null);
  const itemRowsRef = useRef<ItemRow[]>([]);
  const itemTempIdRef = useRef(-1);

  // Dialog state
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

  // New plan form
  const [newPlanTitle, setNewPlanTitle] = useState("");

  const selectedPlan = useMemo(
    () => planRows.find((r) => r.id === selectedPlanId) ?? null,
    [planRows, selectedPlanId],
  );

  const planChangeSummary = useMemo(
    () => summarizeGridStatuses(planRows, (r) => r._status),
    [planRows],
  );

  const itemChangeSummary = useMemo(
    () => summarizeGridStatuses(itemRows, (r) => r._status),
    [itemRows],
  );

  const planRowClassRules = useMemo(() => buildGridRowClassRules<PlanRow>(), []);
  const itemRowClassRules = useMemo(() => buildGridRowClassRules<ItemRow>(), []);

  // ---------------------------------------------------------------------------
  // Plan grid helpers
  // ---------------------------------------------------------------------------
  const commitPlanRows = useCallback((updater: (prev: PlanRow[]) => PlanRow[]) => {
    const prev = planRowsRef.current;
    const next = updater(prev);
    planRowsRef.current = next;
    setPlanRows(next);
  }, []);

  const commitItemRows = useCallback((updater: (prev: ItemRow[]) => ItemRow[]) => {
    const prev = itemRowsRef.current;
    const next = updater(prev);
    itemRowsRef.current = next;
    setItemRows(next);
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch plans
  // ---------------------------------------------------------------------------
  const fetchPlans = useCallback(async (status?: string) => {
    setPlanLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const url = params.size > 0 ? `/api/org/restructure/plans?${params.toString()}` : "/api/org/restructure/plans";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("개편안 목록을 불러오지 못했습니다.");
      const data = (await res.json()) as OrgRestructurePlanListResponse;
      const next = data.items.map(toPlanRow);
      planRowsRef.current = next;
      setPlanRows(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setPlanLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch items for selected plan
  // ---------------------------------------------------------------------------
  const fetchItems = useCallback(async (planId: number) => {
    setItemLoading(true);
    try {
      const res = await fetch(`/api/org/restructure/plans/${planId}/items`, { cache: "no-store" });
      if (!res.ok) throw new Error("항목 목록을 불러오지 못했습니다.");
      const data = (await res.json()) as OrgRestructurePlanItemListResponse;
      const next = data.items.map(toItemRow);
      itemRowsRef.current = next;
      setItemRows(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "항목 조회 실패");
    } finally {
      setItemLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (selectedPlanId == null) {
      itemRowsRef.current = [];
      setItemRows([]);
      return;
    }
    void fetchItems(selectedPlanId);
  }, [selectedPlanId, fetchItems]);

  // ---------------------------------------------------------------------------
  // Plan CRUD
  // ---------------------------------------------------------------------------
  async function createPlan() {
    const title = newPlanTitle.trim();
    if (!title) { toast.error("개편안 제목을 입력해 주세요."); return; }

    setPlanSaving(true);
    try {
      const res = await fetch("/api/org/restructure/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "생성 실패");
        return;
      }
      const plan = (await res.json()) as OrgRestructurePlanItem;
      const newRow = toPlanRow(plan);
      commitPlanRows((prev) => [newRow, ...prev]);
      setSelectedPlanId(plan.id);
      setNewPlanTitle("");
      toast.success(`개편안 "${plan.title}" 생성됨`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setPlanSaving(false);
    }
  }

  async function savePlanChanges() {
    const toUpdate = planRows.filter((r) => r._status === "updated");
    if (toUpdate.length === 0) return;
    setPlanSaving(true);
    try {
      for (const row of toUpdate) {
        const res = await fetch(`/api/org/restructure/plans/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: row.title,
            description: row.description,
            planned_date: row.planned_date,
            status: row.status,
          }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { detail?: string };
          toast.error(json.detail ?? `저장 실패: ${row.title}`);
          return;
        }
        const updated = (await res.json()) as OrgRestructurePlanItem;
        commitPlanRows((prev) =>
          prev.map((r) => (r.id === updated.id ? toPlanRow(updated) : r)),
        );
      }
      toast.success(`개편안 ${toUpdate.length}건 저장됨`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setPlanSaving(false);
    }
  }

  function requestDeletePlan(planId: number) {
    setDeletingPlanId(planId);
    setDeleteDialogOpen(true);
  }

  async function confirmDeletePlan() {
    if (!deletingPlanId) return;
    setPlanSaving(true);
    try {
      const res = await fetch(`/api/org/restructure/plans/${deletingPlanId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(json.detail ?? "삭제 실패");
        return;
      }
      commitPlanRows((prev) => prev.filter((r) => r.id !== deletingPlanId));
      if (selectedPlanId === deletingPlanId) setSelectedPlanId(null);
      toast.success("개편안 삭제됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setPlanSaving(false);
      setDeleteDialogOpen(false);
      setDeletingPlanId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Apply plan
  // ---------------------------------------------------------------------------
  async function applyPlan() {
    if (!selectedPlanId) return;
    setPlanSaving(true);
    try {
      const res = await fetch(`/api/org/restructure/plans/${selectedPlanId}/apply`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as OrgRestructureApplyResponse & { detail?: string };
      if (!res.ok) {
        toast.error(json.detail ?? "적용 실패");
        return;
      }
      toast.success(
        `개편 적용 완료 (적용 ${json.applied_count}건 / 건너뜀 ${json.skipped_count}건)`,
      );
      if (json.messages?.length > 0) {
        for (const msg of json.messages) toast.warning(msg);
      }
      await fetchPlans(statusFilter);
      await fetchItems(selectedPlanId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "적용 실패");
    } finally {
      setPlanSaving(false);
      setApplyDialogOpen(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Item CRUD
  // ---------------------------------------------------------------------------
  function addItem() {
    if (!selectedPlanId) return;
    const id = itemTempIdRef.current--;
    const now = new Date().toISOString();
    const newRow: ItemRow = {
      id,
      plan_id: selectedPlanId,
      action_type: "rename",
      target_dept_id: null,
      target_dept_name: null,
      target_dept_code: null,
      new_parent_id: null,
      new_parent_name: null,
      new_name: null,
      new_code: null,
      new_organization_type: null,
      new_cost_center_code: null,
      sort_order: itemRows.length,
      item_status: "pending",
      memo: null,
      applied_at: null,
      created_at: now,
      updated_at: now,
      _status: "added",
    };
    commitItemRows((prev) => [newRow, ...prev]);
  }

  const toggleItemDelete = useCallback(
    (rowId: number, checked: boolean) => {
      commitItemRows((prev) =>
        toggleDeletedStatus(prev, rowId, checked, {
          removeAddedRow: true,
          shouldBeClean: (candidate) => isItemReverted(candidate),
        }),
      );
    },
    [commitItemRows],
  );

  async function saveItemChanges() {
    if (!selectedPlanId) return;

    const toDelete = itemRows.filter((r) => r._status === "deleted" && r.id > 0);
    const toUpdate = itemRows.filter((r) => r._status === "updated");
    const toInsert = itemRows.filter((r) => r._status === "added");

    if (toDelete.length + toUpdate.length + toInsert.length === 0) return;

    setItemSaving(true);
    try {
      // DELETE
      for (const row of toDelete) {
        const res = await fetch(
          `/api/org/restructure/plans/${selectedPlanId}/items/${row.id}`,
          { method: "DELETE" },
        );
        if (!res.ok && res.status !== 204) {
          const json = (await res.json().catch(() => ({}))) as { detail?: string };
          toast.error(json.detail ?? "삭제 실패");
          return;
        }
      }

      // UPDATE
      for (const row of toUpdate) {
        const res = await fetch(
          `/api/org/restructure/plans/${selectedPlanId}/items/${row.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action_type: row.action_type,
              target_dept_id: row.target_dept_id,
              new_parent_id: row.new_parent_id,
              new_name: row.new_name,
              new_code: row.new_code,
              new_organization_type: row.new_organization_type,
              new_cost_center_code: row.new_cost_center_code,
              sort_order: row.sort_order,
              memo: row.memo,
            }),
          },
        );
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { detail?: string };
          toast.error(json.detail ?? "수정 실패");
          return;
        }
      }

      // INSERT
      for (const row of toInsert) {
        const res = await fetch(`/api/org/restructure/plans/${selectedPlanId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action_type: row.action_type,
            target_dept_id: row.target_dept_id,
            new_parent_id: row.new_parent_id,
            new_name: row.new_name,
            new_code: row.new_code,
            new_organization_type: row.new_organization_type,
            new_cost_center_code: row.new_cost_center_code,
            sort_order: row.sort_order,
            memo: row.memo,
          }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { detail?: string };
          toast.error(json.detail ?? "추가 실패");
          return;
        }
      }

      toast.success(`항목 저장 완료 (입력 ${toInsert.length} / 수정 ${toUpdate.length} / 삭제 ${toDelete.length}건)`);
      await fetchItems(selectedPlanId);
      // Refresh plan row item_count
      await fetchPlans(statusFilter);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setItemSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Plan grid columns
  // ---------------------------------------------------------------------------
  const planColumnDefs = useMemo<ColDef<PlanRow>[]>(
    () => [
      {
        headerName: "상태",
        field: "_status",
        width: 68,
        editable: false,
        sortable: false,
        filter: false,
        cellClass: (p) => getGridStatusCellClass(p.value as RowStatus),
        valueFormatter: (p) => STATUS_LABELS[(p.value as RowStatus) ?? "clean"],
      },
      {
        headerName: "제목",
        field: "title",
        flex: 2,
        minWidth: 160,
        editable: (p) => {
          const s = p.data?.status;
          return s !== "applied" && s !== "cancelled";
        },
      },
      {
        headerName: "진행상태",
        field: "status",
        width: 100,
        editable: (p) => {
          const s = p.data?.status;
          return s !== "applied" && s !== "cancelled";
        },
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: PLAN_STATUS_OPTIONS },
        cellRenderer: (params: ICellRendererParams<PlanRow>) => {
          const s = params.value as OrgRestructurePlanStatus;
          const label = PLAN_STATUS_LABELS[s] ?? s;
          const colors: Record<string, string> = {
            draft: "bg-slate-100 text-slate-700",
            reviewing: "bg-blue-100 text-blue-700",
            applied: "bg-green-100 text-green-700",
            cancelled: "bg-red-100 text-red-700",
          };
          return (
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[s] ?? "bg-slate-100"}`}>
              {label}
            </span>
          );
        },
        valueFormatter: (p) => PLAN_STATUS_LABELS[(p.value as OrgRestructurePlanStatus)] ?? p.value,
      },
      {
        headerName: "예정일",
        field: "planned_date",
        width: 110,
        editable: (p) => {
          const s = p.data?.status;
          return s !== "applied" && s !== "cancelled";
        },
        valueFormatter: (p) => p.value ?? "-",
      },
      {
        headerName: "항목",
        field: "item_count",
        width: 72,
        editable: false,
        cellStyle: { textAlign: "right" },
      },
      {
        headerName: "",
        colId: "actions",
        width: 80,
        editable: false,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: ICellRendererParams<PlanRow>) => {
          const row = params.data;
          if (!row || row._status === "added") return null;
          return (
            <div className="flex h-full items-center justify-center gap-1">
              <button
                type="button"
                className="rounded p-1 text-red-500 hover:bg-red-50"
                title="삭제"
                onClick={(e) => { e.stopPropagation(); requestDeletePlan(row.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [],
  );

  // ---------------------------------------------------------------------------
  // Item grid columns
  // ---------------------------------------------------------------------------
  const itemColumnDefs = useMemo<ColDef<ItemRow>[]>(
    () => [
      {
        headerName: "삭제",
        width: 52,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        resizable: false,
        editable: false,
        cellRenderer: (params: ICellRendererParams<ItemRow>) => {
          const row = params.data;
          if (!row) return null;
          const isApplied = selectedPlan?.status === "applied" || selectedPlan?.status === "cancelled";
          return (
            <div className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                checked={row._status === "deleted"}
                disabled={isApplied}
                className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)] disabled:cursor-not-allowed disabled:opacity-40"
                onChange={(e) => toggleItemDelete(row.id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        },
      },
      {
        headerName: "상태",
        field: "_status",
        width: 68,
        editable: false,
        sortable: false,
        filter: false,
        cellClass: (p) => getGridStatusCellClass(p.value as RowStatus),
        valueFormatter: (p) => STATUS_LABELS[(p.value as RowStatus) ?? "clean"],
      },
      {
        headerName: "순서",
        field: "sort_order",
        width: 72,
        editable: (p) => p.data?._status !== "deleted",
        cellStyle: { textAlign: "right" },
        valueParser: (p) => parseInt(p.newValue, 10) || 0,
      },
      {
        headerName: "유형",
        field: "action_type",
        width: 110,
        editable: (p) => p.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ACTION_TYPE_OPTIONS },
        valueFormatter: (p) =>
          ACTION_TYPE_LABELS[(p.value as OrgRestructureActionType)] ?? p.value,
      },
      {
        headerName: "대상 부서 ID",
        field: "target_dept_id",
        width: 110,
        editable: (p) => p.data?._status !== "deleted",
        valueParser: (p) => {
          const v = parseInt(p.newValue, 10);
          return isNaN(v) ? null : v;
        },
        valueFormatter: (p) => {
          const v = p.value as number | null;
          const name = p.data?.target_dept_name;
          if (v == null) return "-";
          return name ? `${v} (${name})` : String(v);
        },
      },
      {
        headerName: "새 상위 ID",
        field: "new_parent_id",
        width: 110,
        editable: (p) => p.data?._status !== "deleted",
        valueParser: (p) => {
          const v = parseInt(p.newValue, 10);
          return isNaN(v) ? null : v;
        },
        valueFormatter: (p) => {
          const v = p.value as number | null;
          const name = p.data?.new_parent_name;
          if (v == null) return "-";
          return name ? `${v} (${name})` : String(v);
        },
      },
      {
        headerName: "새 이름",
        field: "new_name",
        flex: 1,
        minWidth: 130,
        editable: (p) => p.data?._status !== "deleted",
        valueFormatter: (p) => (p.value as string | null) ?? "-",
      },
      {
        headerName: "새 코드",
        field: "new_code",
        width: 110,
        editable: (p) => p.data?._status !== "deleted",
        valueFormatter: (p) => (p.value as string | null) ?? "-",
      },
      {
        headerName: "처리상태",
        field: "item_status",
        width: 90,
        editable: false,
        valueFormatter: (p) => ITEM_STATUS_LABELS[p.value as string] ?? p.value,
        cellClass: (p) => {
          const s = p.value as string;
          if (s === "applied") return "text-green-600 font-medium";
          if (s === "skipped") return "text-amber-600";
          return "";
        },
      },
      {
        headerName: "메모",
        field: "memo",
        flex: 1.5,
        minWidth: 160,
        editable: (p) => p.data?._status !== "deleted",
        valueFormatter: (p) => (p.value as string | null) ?? "",
      },
    ],
    [toggleItemDelete, selectedPlan?.status],
  );

  const planDefaultColDef = useMemo<ColDef<PlanRow>>(
    () => ({ sortable: true, filter: false, resizable: true, editable: false, suppressMovable: true }),
    [],
  );

  const itemDefaultColDef = useMemo<ColDef<ItemRow>>(
    () => ({ sortable: true, filter: false, resizable: true, editable: false, suppressMovable: true }),
    [],
  );

  const onPlanGridReady = useCallback((e: GridReadyEvent<PlanRow>) => {
    planGridApiRef.current = e.api;
  }, []);

  const onItemGridReady = useCallback((e: GridReadyEvent<ItemRow>) => {
    itemGridApiRef.current = e.api;
  }, []);

  const onPlanCellValueChanged = useCallback(
    (e: CellValueChangedEvent<PlanRow>) => {
      if (e.newValue === e.oldValue) return;
      const rowId = e.data?.id;
      if (rowId == null) return;
      commitPlanRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          return reconcileUpdatedStatus({ ...row } as PlanRow, {
            shouldBeClean: (candidate) => isPlanReverted(candidate),
          });
        }),
      );
    },
    [commitPlanRows],
  );

  const onItemCellValueChanged = useCallback(
    (e: CellValueChangedEvent<ItemRow>) => {
      if (e.newValue === e.oldValue) return;
      const rowId = e.data?.id;
      if (rowId == null) return;
      commitItemRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          return reconcileUpdatedStatus({ ...row } as ItemRow, {
            shouldBeClean: (candidate) => isItemReverted(candidate),
          });
        }),
      );
    },
    [commitItemRows],
  );

  const canApply =
    selectedPlan?.status === "draft" || selectedPlan?.status === "reviewing";

  const planHasDirty = planRows.some((r) => r._status !== "clean");
  const itemHasDirty = itemRows.some((r) => r._status !== "clean");

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <ManagerPageShell>
      <div className="flex h-full min-h-0 flex-col gap-0">
        {/* ─── Top bar ─── */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <h2 className="text-base font-semibold text-slate-800">조직개편안 관리</h2>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">전체 상태</option>
              {PLAN_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {PLAN_STATUS_LABELS[s as OrgRestructurePlanStatus]}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchPlans(statusFilter)}
              disabled={planLoading}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              조회
            </Button>
          </div>
        </div>

        {/* ─── Split pane ─── */}
        <div className="flex min-h-0 flex-1 gap-0">
          {/* ─── Plans panel ─── */}
          <div className="flex w-[380px] min-w-[280px] flex-shrink-0 flex-col border-r border-slate-200">
            {/* Plans toolbar */}
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <span className="text-xs font-medium text-slate-500">개편안 목록</span>
              <span className="text-xs text-slate-400">({planRows.length}건)</span>
              {planChangeSummary.updated > 0 && (
                <Badge variant="outline" className="ml-auto text-xs">
                  수정 {planChangeSummary.updated}
                </Badge>
              )}
              {planChangeSummary.updated > 0 && can("save") && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  disabled={planSaving || menuActionLoading}
                  onClick={() => void savePlanChanges()}
                >
                  <Save className="mr-1 h-3 w-3" />
                  저장
                </Button>
              )}
            </div>

            {/* New plan input */}
            {can("create") && (
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Input
                  value={newPlanTitle}
                  onChange={(e) => setNewPlanTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void createPlan(); }}
                  placeholder="개편안 제목"
                  className="h-8 flex-1 text-xs"
                  disabled={planSaving}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={planSaving || !newPlanTitle.trim()}
                  onClick={() => void createPlan()}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  추가
                </Button>
              </div>
            )}

            {/* Plans grid */}
            <div className="min-h-0 flex-1 p-2">
              <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
                <AgGridReact<PlanRow>
                  theme="legacy"
                  rowData={planRows}
                  columnDefs={planColumnDefs}
                  defaultColDef={planDefaultColDef}
                  getRowId={(p) => String(p.data.id)}
                  rowSelection={{ mode: "singleRow", enableClickSelection: true }}
                  singleClickEdit
                  animateRows={false}
                  rowClassRules={planRowClassRules}
                  getRowClass={(p) => getGridRowClass(p.data?._status)}
                  loading={planLoading}
                  localeText={AG_GRID_LOCALE_KO}
                  overlayNoRowsTemplate='<span class="text-sm text-slate-400">개편안이 없습니다.</span>'
                  headerHeight={32}
                  rowHeight={34}
                  onGridReady={onPlanGridReady}
                  onRowClicked={(e) => { if (e.data) setSelectedPlanId(e.data.id); }}
                  onCellValueChanged={onPlanCellValueChanged}
                />
              </div>
            </div>
          </div>

          {/* ─── Items panel ─── */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Items toolbar */}
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
              {selectedPlan ? (
                <>
                  <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">
                    {selectedPlan.title}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      {
                        draft: "bg-slate-100 text-slate-700",
                        reviewing: "bg-blue-100 text-blue-700",
                        applied: "bg-green-100 text-green-700",
                        cancelled: "bg-red-100 text-red-700",
                      }[selectedPlan.status]
                    }`}
                  >
                    {PLAN_STATUS_LABELS[selectedPlan.status]}
                  </span>
                  {itemChangeSummary.added + itemChangeSummary.updated + itemChangeSummary.deleted > 0 && (
                    <span className="text-xs text-slate-400">
                      변경 {itemChangeSummary.added + itemChangeSummary.updated + itemChangeSummary.deleted}건
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-400">개편안을 선택하세요</span>
              )}

              <div className="ml-auto flex items-center gap-2">
                {selectedPlan && can("create") && selectedPlan.status !== "applied" && selectedPlan.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={itemSaving}
                    onClick={addItem}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    항목추가
                  </Button>
                )}
                {selectedPlan && itemHasDirty && can("save") && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    disabled={itemSaving || menuActionLoading}
                    onClick={() => void saveItemChanges()}
                  >
                    <Save className="mr-1 h-3 w-3" />
                    저장
                  </Button>
                )}
                {selectedPlan && canApply && can("save") && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 bg-green-600 text-xs text-white hover:bg-green-700"
                    disabled={planSaving || itemHasDirty}
                    onClick={() => setApplyDialogOpen(true)}
                    title={itemHasDirty ? "저장 후 적용 가능합니다" : undefined}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    개편 적용
                  </Button>
                )}
              </div>
            </div>

            {/* Items grid */}
            <div className="min-h-0 flex-1 p-2">
              <div className="ag-theme-quartz vibe-grid h-full w-full overflow-hidden rounded-lg border border-gray-200">
                <AgGridReact<ItemRow>
                  theme="legacy"
                  rowData={itemRows}
                  columnDefs={itemColumnDefs}
                  defaultColDef={itemDefaultColDef}
                  getRowId={(p) => String(p.data.id)}
                  rowSelection={{ mode: "singleRow", enableClickSelection: true }}
                  singleClickEdit
                  animateRows={false}
                  rowClassRules={itemRowClassRules}
                  getRowClass={(p) => getGridRowClass(p.data?._status)}
                  loading={itemLoading}
                  localeText={AG_GRID_LOCALE_KO}
                  overlayNoRowsTemplate={
                    selectedPlanId
                      ? '<span class="text-sm text-slate-400">항목이 없습니다. 항목을 추가하세요.</span>'
                      : '<span class="text-sm text-slate-400">왼쪽에서 개편안을 선택하세요.</span>'
                  }
                  headerHeight={36}
                  rowHeight={34}
                  onGridReady={onItemGridReady}
                  onCellValueChanged={onItemCellValueChanged}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply confirmation */}
      <ConfirmDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        title="개편안을 적용하시겠습니까?"
        description={`"${selectedPlan?.title}" 개편안의 모든 항목이 실제 조직 구조에 반영됩니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="적용"
        cancelLabel="취소"
        onConfirm={() => void applyPlan()}
      />

      {/* Delete plan confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="개편안을 삭제하시겠습니까?"
        description="개편안과 모든 항목이 삭제됩니다. 이미 적용된 개편안은 삭제할 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        confirmVariant="destructive"
        onConfirm={() => void confirmDeletePlan()}
      />
    </ManagerPageShell>
  );
}
