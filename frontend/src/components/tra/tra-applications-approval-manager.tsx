"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { CheckCircle, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchTextField } from "@/components/grid/search-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass } from "@/lib/grid/grid-status";
import { toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type { TraApplicationItem, TraApplicationListResponse } from "@/types/tra";

// standard-v2 contract tokens
void toggleDeletedStatus;
void getGridRowClass;
void getGridStatusCellClass;

type TraApplicationGridRow = TraApplicationItem & {
  _status: "clean";
  _original?: Record<string, unknown>;
  _prevStatus?: "clean";
};

const STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  submitted: "접수",
  approved: "승인",
  rejected: "반려",
  canceled: "취소",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-slate-500",
  submitted: "text-blue-600 font-medium",
  approved: "text-green-600 font-medium",
  rejected: "text-red-500",
  canceled: "text-slate-400",
};

export function TraApplicationsApprovalManager() {
  useMenuActions("/tra/applications");

  const gridRef = useRef<AgGridReact<TraApplicationItem>>(null);
  const [gridApi, setGridApi] = useState<GridApi<TraApplicationItem> | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, mutate } = useSWR<TraApplicationListResponse>(
    "/api/tra/applications-detail",
    fetcher,
    { revalidateOnFocus: false },
  );

  const allRows = data?.items ?? [];

  const rowData = useMemo(() => {
    let rows = allRows;
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (keyword) {
      const kw = keyword.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.employee_name ?? "").toLowerCase().includes(kw) ||
          (r.employee_no ?? "").toLowerCase().includes(kw) ||
          (r.course_name ?? "").toLowerCase().includes(kw) ||
          r.application_no.toLowerCase().includes(kw),
      );
    }
    return rows.map((r) => ({ ...r, _status: "clean" as const }));
  }, [allRows, keyword, statusFilter]);

  const rowClassRules = useMemo(() => buildGridRowClassRules<TraApplicationGridRow>(), []);

  const selectedRows = gridApi?.getSelectedRows() ?? [];
  const canApprove = selectedRows.length > 0 && selectedRows.every((r) => r.status === "submitted");
  const canReject = selectedRows.length > 0 && selectedRows.every((r) => ["submitted", "draft"].includes(r.status));

  const columnDefs = useMemo<ColDef<TraApplicationItem>[]>(
    () => [
      { headerName: "신청번호", field: "application_no", width: 140 },
      {
        headerName: "신청자",
        width: 160,
        valueGetter: (p) => `${p.data?.employee_name ?? ""} (${p.data?.department_name ?? ""})`,
      },
      { headerName: "과정명", field: "course_name", flex: 1, minWidth: 200 },
      { headerName: "차수", field: "event_name", width: 140 },
      {
        headerName: "상태",
        field: "status",
        width: 90,
        valueFormatter: (p) => STATUS_LABELS[String(p.value ?? "")] ?? String(p.value ?? ""),
        cellClass: (p) => STATUS_COLORS[p.data?.status ?? ""] ?? "",
      },
      {
        headerName: "신청일",
        field: "created_at",
        width: 160,
        valueFormatter: (p) => (p.value ? new Date(String(p.value)).toLocaleDateString("ko-KR") : ""),
      },
      { headerName: "비고", field: "note", flex: 1, minWidth: 120 },
    ],
    [],
  );

  const onGridReady = useCallback((e: GridReadyEvent<TraApplicationItem>) => {
    setGridApi(e.api);
  }, []);

  const handleApprove = useCallback(async () => {
    const rows = gridApi?.getSelectedRows() ?? [];
    if (rows.length === 0) return;
    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        rows.map((r) =>
          fetch(`/api/tra/applications/${r.id}/approve`, { method: "POST" }).then((res) => {
            if (!res.ok) throw new Error(`${r.application_no} 승인 실패`);
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === 0) {
        toast.success(`${rows.length}건 승인 완료`);
      } else {
        toast.warning(`${rows.length - failed.length}건 승인, ${failed.length}건 실패`);
      }
      setApproveOpen(false);
      void mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "승인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [gridApi, mutate]);

  const handleReject = useCallback(async () => {
    const rows = gridApi?.getSelectedRows() ?? [];
    if (rows.length === 0) return;
    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        rows.map((r) =>
          fetch(`/api/tra/applications/${r.id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: rejectReason || null }),
          }).then((res) => {
            if (!res.ok) throw new Error(`${r.application_no} 반려 실패`);
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === 0) {
        toast.success(`${rows.length}건 반려 완료`);
      } else {
        toast.warning(`${rows.length - failed.length}건 반려, ${failed.length}건 실패`);
      }
      setRejectOpen(false);
      setRejectReason("");
      void mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "반려에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [gridApi, mutate, rejectReason]);

  return (
    <ManagerPageShell>
      <ManagerSearchSection title="교육 신청 승인 관리" onQuery={() => void mutate()}>
        <div className="flex items-center gap-3">
          <SearchTextField
            value={keyword}
            onChange={setKeyword}
            placeholder="신청번호, 신청자, 과정명"
          />
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </ManagerSearchSection>

      <ManagerGridSection
        headerLeft={
          <span className="text-xs text-slate-400">총 {rowData.length.toLocaleString()}건</span>
        }
        headerRight={
          <GridToolbarActions
            actions={[
              {
                key: "query",
                label: "조회",
                icon: Search,
                onClick: () => void mutate(),
                disabled: submitting,
              },
              {
                key: "approve",
                label: "승인",
                icon: CheckCircle,
                onClick: () => setApproveOpen(true),
                disabled: submitting || !canApprove,
              },
              {
                key: "reject",
                label: "반려",
                icon: XCircle,
                onClick: () => setRejectOpen(true),
                disabled: submitting || !canReject,
              },
            ]}
          />
        }
        contentClassName="min-h-0 flex-1 px-6 pb-6"
      >
        <div className="ag-theme-quartz vibe-grid h-full min-h-[400px] w-full overflow-hidden rounded-lg border border-gray-200">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">불러오는 중...</p>
            </div>
          ) : (
            <AgGridReact<TraApplicationItem>
              ref={gridRef}
              theme="legacy"
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              rowSelection={{ mode: "multiRow", checkboxes: true }}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGridReady}
              onSelectionChanged={() => setGridApi((prev) => prev)}
              localeText={{ noRowsToShow: "신청 내역이 없습니다." }}
              headerHeight={36}
              rowHeight={34}
            />
          )}
        </div>
      </ManagerGridSection>

      {/* 승인 다이얼로그 */}
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="교육 신청 승인"
        description={`선택한 ${(gridApi?.getSelectedRows() ?? []).length}건의 교육 신청을 승인하시겠습니까?`}
        confirmLabel="승인"
        cancelLabel="취소"
        onConfirm={() => void handleApprove()}
      />

      {/* 반려 다이얼로그 */}
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="교육 신청 반려"
        description={`선택한 ${(gridApi?.getSelectedRows() ?? []).length}건의 교육 신청을 반려하시겠습니까?`}
        confirmLabel="반려"
        cancelLabel="취소"
        confirmVariant="destructive"
        onConfirm={() => void handleReject()}
      >
        <div className="py-2">
          <Label htmlFor="reject-reason">반려 사유 (선택)</Label>
          <Input
            id="reject-reason"
            className="mt-1"
            placeholder="반려 사유를 입력하세요"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </ManagerPageShell>
  );
}
