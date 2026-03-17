"use client";

import React, { useCallback, useMemo, useState } from "react";
import { CheckCircle, RefreshCcw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import useSWR from "swr";

import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  TraApplicationActionResponse,
  TraApplicationItem,
  TraApplicationListResponse,
  TraApplicationRejectRequest,
} from "@/types/tra";

const STATUS_LABELS: Record<string, string> = {
  draft: "작성중",
  submitted: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  canceled: "취소",
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "text-amber-600 font-medium",
  approved: "text-emerald-600 font-medium",
  rejected: "text-red-600 font-medium",
  canceled: "text-slate-400",
};

export function TraApplicationsApprovalManager() {
  useMenuActions("/tra/applications");

  const [page, setPage] = useState(1);
  const [working, setWorking] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TraApplicationItem | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Approve/Reject dialog
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const pageSize = 50;

  const { data, isLoading, mutate } = useSWR<TraApplicationListResponse>(
    "/api/tra/applications-detail",
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.total_count ?? 0;

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!kw) return true;
      return (
        item.application_no.toLowerCase().includes(kw) ||
        (item.employee_name ?? "").toLowerCase().includes(kw) ||
        (item.employee_no ?? "").toLowerCase().includes(kw) ||
        (item.course_name ?? "").toLowerCase().includes(kw)
      );
    });
  }, [items, keyword, statusFilter]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page]);

  const pagination = useGridPagination({
    page,
    totalCount: filteredItems.length,
    pageSize,
    onPageChange: setPage,
  });

  const canApprove = selectedRow?.status === "submitted";
  const canReject = selectedRow?.status === "submitted" || selectedRow?.status === "draft";

  const columnDefs = useMemo<ColDef<TraApplicationItem>[]>(
    () => [
      { headerName: "신청번호", field: "application_no", width: 180 },
      {
        headerName: "신청자",
        minWidth: 180,
        flex: 1,
        valueGetter: (p) =>
          p.data ? `${p.data.employee_name ?? ""} (${p.data.employee_no ?? ""}) / ${p.data.department_name ?? ""}` : "",
      },
      { headerName: "과정명", field: "course_name", flex: 1, minWidth: 160 },
      { headerName: "차수", field: "event_name", width: 140 },
      {
        headerName: "상태",
        field: "status",
        width: 110,
        cellRenderer: (params: { value: string }) => {
          const label = STATUS_LABELS[params.value] ?? params.value;
          const cls = STATUS_COLORS[params.value] ?? "";
          return `<span class="${cls}">${label}</span>`;
        },
      },
      {
        headerName: "신청일",
        field: "created_at",
        width: 120,
        valueFormatter: (p) => String(p.value ?? "").slice(0, 10),
      },
      { headerName: "비고", field: "note", flex: 1, minWidth: 120 },
    ],
    [],
  );

  const handleApprove = useCallback(async () => {
    if (!selectedRow) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/tra/applications/${selectedRow.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "승인에 실패했습니다.");
        return;
      }
      const json = (await res.json()) as TraApplicationActionResponse;
      toast.success(`${json.item.application_no} 승인 완료.`);
      setApproveOpen(false);
      setSelectedRow(null);
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "승인에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }, [selectedRow, mutate]);

  const handleReject = useCallback(async () => {
    if (!selectedRow) return;
    setWorking(true);
    try {
      const payload: TraApplicationRejectRequest = { reason: rejectReason.trim() || null };
      const res = await fetch(`/api/tra/applications/${selectedRow.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "반려에 실패했습니다.");
        return;
      }
      const json = (await res.json()) as TraApplicationActionResponse;
      toast.success(`${json.item.application_no} 반려 완료.`);
      setRejectOpen(false);
      setRejectReason("");
      setSelectedRow(null);
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "반려에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }, [selectedRow, rejectReason, mutate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500">교육신청 내역을 불러오는 중입니다.</p>
      </div>
    );
  }

  return (
    <>
      <ManagerPageShell>
        <ManagerSearchSection title="교육신청 결재" onQuery={() => void mutate()}>
          <div className="grid gap-2 md:grid-cols-[1fr_180px]">
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="신청번호, 사번, 이름, 과정명"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void mutate()}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
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
              />
              <span className="text-xs text-slate-400">총 {filteredItems.length.toLocaleString()}건</span>
            </>
          }
          headerRight={
            <GridToolbarActions
              actions={[
                { key: "query", label: "조회", icon: Search, onClick: () => void mutate(), disabled: working },
                {
                  key: "approve",
                  label: "승인",
                  icon: CheckCircle,
                  onClick: () => setApproveOpen(true),
                  disabled: working || !canApprove,
                },
                {
                  key: "reject",
                  label: "반려",
                  icon: XCircle,
                  onClick: () => {
                    setRejectReason("");
                    setRejectOpen(true);
                  },
                  disabled: working || !canReject,
                },
              ]}
              saveAction={{
                key: "refresh",
                label: "새로고침",
                icon: RefreshCcw,
                onClick: () => void mutate(),
                disabled: working,
              }}
            />
          }
          contentClassName="min-h-0 flex-1 px-6 pb-6"
        >
          <div className="ag-theme-quartz vibe-grid h-full min-h-[400px] w-full overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<TraApplicationItem>
              theme="legacy"
              rowData={pagedItems}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onRowClicked={(event) => setSelectedRow(event.data ?? null)}
              localeText={{ noRowsToShow: "교육신청 내역이 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">교육신청 내역이 없습니다.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          </div>
        </ManagerGridSection>
      </ManagerPageShell>

      {/* 승인 확인 다이얼로그 */}
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="교육신청 승인"
        description={`${selectedRow?.application_no ?? ""} (${selectedRow?.employee_name ?? ""}) 신청을 승인하시겠습니까?`}
        confirmLabel="승인"
        cancelLabel="취소"
        confirmVariant="save"
        busy={working}
        onConfirm={handleApprove}
      />

      {/* 반려 다이얼로그 */}
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="교육신청 반려"
        confirmLabel="반려"
        cancelLabel="취소"
        confirmVariant="destructive"
        busy={working}
        onConfirm={handleReject}
        description={
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {selectedRow?.application_no} ({selectedRow?.employee_name}) 신청을 반려합니다.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">반려 사유 (선택)</label>
              <Input
                type="text"
                placeholder="반려 사유를 입력하세요"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        }
      />
    </>
  );
}
