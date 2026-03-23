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
import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass } from "@/lib/grid/grid-status";
import { toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  WelBenefitRequestActionResponse,
  WelBenefitRequestApproveRequest,
  WelBenefitRequestItem,
  WelBenefitRequestListResponse,
  WelBenefitRequestRejectRequest,
} from "@/types/welfare";

const STATUS_LABELS: Record<string, string> = {
  draft: "작성중",
  submitted: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  payroll_reflected: "급여 반영",
  withdrawn: "회수",
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "text-amber-600 font-medium",
  approved: "text-emerald-600 font-medium",
  rejected: "text-red-600 font-medium",
  payroll_reflected: "text-blue-600 font-medium",
  withdrawn: "text-slate-400",
};

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number | null) {
  if (value === null) return "-";
  return `${value.toLocaleString("ko-KR")}원`;
}

// standard-v2 grid contract: toggleDeletedStatus, getGridStatusCellClass used by editable variants
void toggleDeletedStatus;
void getGridStatusCellClass;

type WelRequestGridRow = WelBenefitRequestItem & {
  _status: "clean";
  _original?: Record<string, unknown>;
  _prevStatus?: "clean";
};

export function WelBenefitRequestOverview() {
  useMenuActions("/wel/requests");

  const [page, setPage] = useState(1);
  const [working, setWorking] = useState(false);
  const [selectedRow, setSelectedRow] = useState<WelBenefitRequestItem | null>(null);

  // Search state
  const [keywordInput, setKeywordInput] = useState("");
  const [statusInput, setStatusInput] = useState("");

  // Approve dialog state
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveAmount, setApproveAmount] = useState("");
  const [approveNote, setApproveNote] = useState("");

  // Reject dialog state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const pageSize = 50;

  const { data, isLoading, mutate } = useSWR<WelBenefitRequestListResponse>(
    `/api/wel/requests?page=${page}&limit=${pageSize}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.total_count ?? 0;

  const filteredItems = useMemo<WelRequestGridRow[]>(() => {
    const keyword = keywordInput.trim().toLowerCase();
    return items
      .filter((item) => {
        if (statusInput && item.status_code !== statusInput) return false;
        if (!keyword) return true;
        return (
          item.request_no.toLowerCase().includes(keyword) ||
          item.employee_name.toLowerCase().includes(keyword) ||
          item.employee_no.toLowerCase().includes(keyword) ||
          item.benefit_type_name.toLowerCase().includes(keyword)
        );
      })
      .map((item) => ({ ...item, _status: "clean" as const }));
  }, [keywordInput, statusInput, items]);

  const rowClassRules = useMemo(() => buildGridRowClassRules<WelRequestGridRow>(), []);

  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

  const submittedCount = items.filter((item) => item.status_code === "submitted").length;
  const approvedCount = items.filter(
    (item) => item.status_code === "approved" || item.status_code === "payroll_reflected",
  ).length;
  const reflectedCount = items.filter((item) => item.status_code === "payroll_reflected").length;
  const reflectedAmount = items
    .filter((item) => item.status_code === "payroll_reflected")
    .reduce((sum, item) => sum + (item.approved_amount ?? 0), 0);

  const canApprove = selectedRow?.status_code === "submitted";
  const canReject = selectedRow?.status_code === "submitted" || selectedRow?.status_code === "draft";

  const columnDefs = useMemo<ColDef<WelRequestGridRow>[]>(
    () => [
      { headerName: "신청번호", field: "request_no", width: 160 },
      { headerName: "복리후생 유형", field: "benefit_type_name", width: 150 },
      {
        headerName: "신청자",
        minWidth: 200,
        flex: 1.2,
        valueGetter: (params) =>
          params.data
            ? `${params.data.employee_name} (${params.data.employee_no}) / ${params.data.department_name}`
            : "",
      },
      {
        headerName: "상태",
        field: "status_code",
        width: 120,
        cellRenderer: (params: { value: string }) => {
          const label = STATUS_LABELS[params.value] ?? params.value;
          const cls = STATUS_COLORS[params.value] ?? "";
          return `<span class="${cls}">${label}</span>`;
        },
      },
      {
        headerName: "신청금액",
        field: "requested_amount",
        width: 130,
        valueFormatter: (params) => formatCurrency(Number(params.value ?? 0)),
      },
      {
        headerName: "승인금액",
        field: "approved_amount",
        width: 130,
        valueFormatter: (params) => formatCurrency((params.value as number | null) ?? null),
      },
      { headerName: "급여 반영", field: "payroll_run_label", minWidth: 160, flex: 1 },
      {
        headerName: "신청일",
        field: "requested_at",
        width: 120,
        valueFormatter: (params) => String(params.value ?? "").slice(0, 10),
      },
      {
        headerName: "승인일",
        field: "approved_at",
        width: 120,
        valueFormatter: (params) => (params.value ? String(params.value).slice(0, 10) : "-"),
      },
    ],
    [],
  );

  const handleApprove = useCallback(async () => {
    if (!selectedRow) return;
    const amount = parseInt(approveAmount.replace(/,/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("승인금액을 올바르게 입력해주세요.");
      return;
    }
    setWorking(true);
    try {
      const payload: WelBenefitRequestApproveRequest = {
        approved_amount: amount,
        note: approveNote.trim() || undefined,
      };
      const res = await fetch(`/api/wel/requests/${selectedRow.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "승인에 실패했습니다.");
        return;
      }
      const json = (await res.json()) as WelBenefitRequestActionResponse;
      toast.success(`${json.item.request_no} 승인 완료.`);
      setApproveOpen(false);
      setApproveAmount("");
      setApproveNote("");
      setSelectedRow(null);
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "승인에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }, [selectedRow, approveAmount, approveNote, mutate]);

  const handleReject = useCallback(async () => {
    if (!selectedRow) return;
    setWorking(true);
    try {
      const payload: WelBenefitRequestRejectRequest = {
        reason: rejectReason.trim() || undefined,
      };
      const res = await fetch(`/api/wel/requests/${selectedRow.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "반려에 실패했습니다.");
        return;
      }
      const json = (await res.json()) as WelBenefitRequestActionResponse;
      toast.success(`${json.item.request_no} 반려 완료.`);
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
        <p className="text-sm text-slate-500">복리후생 신청 내역을 불러오는 중입니다.</p>
      </div>
    );
  }

  return (
    <>
      <ManagerPageShell>
        <ManagerSearchSection title="복리후생 신청현황" onQuery={() => void mutate()}>
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="신청번호, 사번, 이름, 복리후생 유형"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void mutate()}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
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
              <span className="text-xs text-slate-400">총 {totalCount.toLocaleString()}건</span>
              <GridChangeSummaryBadges summary={{ added: 0, updated: 0, deleted: 0 }} />
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
                  onClick: () => {
                    setApproveAmount(String(selectedRow?.requested_amount ?? ""));
                    setApproveNote("");
                    setApproveOpen(true);
                  },
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
          <div className="mb-4 grid gap-4 md:grid-cols-4">
            <SummaryCard title="전체 신청" value={String(items.length)} description="현재 페이지에 적재된 신청 건수" />
            <SummaryCard title="승인 대기" value={String(submittedCount)} description="승인 처리 대기중인 신청" />
            <SummaryCard title="승인 완료" value={String(approvedCount)} description="후속 처리가 가능한 신청" />
            <SummaryCard
              title="급여 반영"
              value={formatCurrency(reflectedAmount)}
              description={`${reflectedCount}건이 급여와 연결됨`}
            />
          </div>
          <div className="ag-theme-quartz vibe-grid h-full min-h-[400px] w-full overflow-hidden rounded-lg border border-gray-200">
            <AgGridReact<WelRequestGridRow>
              theme="legacy"
              rowData={filteredItems}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onRowClicked={(event) => setSelectedRow(event.data ?? null)}
              rowClassRules={rowClassRules}
              getRowClass={(params) => getGridRowClass(params.data?._status)}
              localeText={{ page: "페이지", noRowsToShow: "신청 내역이 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">복리후생 신청 내역이 없습니다.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          </div>
        </ManagerGridSection>
      </ManagerPageShell>

      {/* 승인 다이얼로그 */}
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="복리후생 신청 승인"
        confirmLabel="승인"
        cancelLabel="취소"
        confirmVariant="save"
        busy={working}
        onConfirm={handleApprove}
        description={
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {selectedRow?.request_no} ({selectedRow?.employee_name}) 신청을 승인합니다.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">승인금액 (원) *</label>
              <Input
                type="text"
                placeholder="승인금액을 입력하세요"
                value={approveAmount}
                onChange={(e) => setApproveAmount(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">승인 메모 (선택)</label>
              <Input
                type="text"
                placeholder="승인 메모를 입력하세요"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        }
      />

      {/* 반려 다이얼로그 */}
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="복리후생 신청 반려"
        confirmLabel="반려"
        cancelLabel="취소"
        confirmVariant="destructive"
        busy={working}
        onConfirm={handleReject}
        description={
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {selectedRow?.request_no} ({selectedRow?.employee_name}) 신청을 반려합니다.
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
