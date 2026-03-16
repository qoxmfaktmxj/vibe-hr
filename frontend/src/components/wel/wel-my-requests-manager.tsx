"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, RefreshCcw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import useSWR from "swr";

import { ManagerGridSection, ManagerPageShell, ManagerSearchSection } from "@/components/grid/manager-layout";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { fetcher } from "@/lib/fetcher";
import { useMenuActions } from "@/lib/menu/use-menu-actions";
import type {
  WelBenefitRequestActionResponse,
  WelBenefitRequestCreateRequest,
  WelBenefitRequestItem,
  WelBenefitRequestListResponse,
  WelBenefitTypeItem,
  WelBenefitTypeListResponse,
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

function formatCurrency(value: number | null) {
  if (value === null) return "-";
  return `${value.toLocaleString("ko-KR")}원`;
}

export function WelMyRequestsManager() {
  useMenuActions("/wel/my-requests");

  const [page, setPage] = useState(1);
  const [working, setWorking] = useState(false);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createTypeCode, setCreateTypeCode] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  // Withdraw confirm dialog state
  const [withdrawTarget, setWithdrawTarget] = useState<WelBenefitRequestItem | null>(null);

  const pageSize = 50;

  const { data: requestsData, isLoading, mutate } = useSWR<WelBenefitRequestListResponse>(
    "/api/wel/my-requests",
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: typesData } = useSWR<WelBenefitTypeListResponse>(
    "/api/wel/benefit-types?limit=100",
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = useMemo(() => requestsData?.items ?? [], [requestsData?.items]);
  const activeTypes = useMemo(
    () => (typesData?.items ?? []).filter((t) => t.is_active),
    [typesData?.items],
  );
  const totalCount = requestsData?.total_count ?? 0;

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page]);
  const pagination = useGridPagination({ page, totalCount, pageSize, onPageChange: setPage });

  const columnDefs = useMemo<ColDef<WelBenefitRequestItem>[]>(
    () => [
      { headerName: "신청번호", field: "request_no", width: 160 },
      { headerName: "복리후생 유형", field: "benefit_type_name", width: 150 },
      {
        headerName: "상태",
        field: "status_code",
        width: 110,
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
      {
        headerName: "신청일",
        field: "requested_at",
        width: 110,
        valueFormatter: (params) => String(params.value ?? "").slice(0, 10),
      },
      {
        headerName: "승인일",
        field: "approved_at",
        width: 110,
        valueFormatter: (params) => (params.value ? String(params.value).slice(0, 10) : "-"),
      },
      { headerName: "급여 반영", field: "payroll_run_label", width: 160 },
      { headerName: "내용", field: "description", flex: 1, minWidth: 200 },
    ],
    [],
  );

  const handleCreate = useCallback(async () => {
    if (!createTypeCode) {
      toast.error("복리후생 유형을 선택해주세요.");
      return;
    }
    const amount = parseInt(createAmount.replace(/,/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("신청금액을 올바르게 입력해주세요.");
      return;
    }

    setWorking(true);
    try {
      const payload: WelBenefitRequestCreateRequest = {
        benefit_type_code: createTypeCode,
        requested_amount: amount,
        description: createDescription.trim() || null,
      };
      const res = await fetch("/api/wel/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "신청에 실패했습니다.");
        return;
      }
      const json = (await res.json()) as WelBenefitRequestActionResponse;
      toast.success(`${json.item.request_no} 신청이 접수되었습니다.`);
      setCreateOpen(false);
      setCreateTypeCode("");
      setCreateAmount("");
      setCreateDescription("");
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "신청에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }, [createTypeCode, createAmount, createDescription, mutate]);

  const handleWithdraw = useCallback(async () => {
    if (!withdrawTarget) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/wel/requests/${withdrawTarget.id}/withdraw`, {
        method: "PUT",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        toast.error(err.detail ?? "회수에 실패했습니다.");
        return;
      }
      toast.success(`${withdrawTarget.request_no} 신청을 회수했습니다.`);
      setWithdrawTarget(null);
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "회수에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }, [withdrawTarget, mutate]);

  const [selectedRow, setSelectedRow] = useState<WelBenefitRequestItem | null>(null);
  const canWithdraw = selectedRow?.status_code === "submitted" || selectedRow?.status_code === "draft";

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
        <ManagerSearchSection title="내 복리후생 신청" onQuery={() => void mutate()}>
          <p className="text-sm text-slate-500">복리후생 신청 내역을 조회하고 신규 신청할 수 있습니다.</p>
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
            </>
          }
          headerRight={
            <GridToolbarActions
              actions={[
                { key: "query", label: "조회", icon: Search, onClick: () => void mutate(), disabled: working },
                {
                  key: "create",
                  label: "신청",
                  icon: Plus,
                  onClick: () => setCreateOpen(true),
                  disabled: working,
                },
                {
                  key: "withdraw",
                  label: "회수",
                  icon: XCircle,
                  onClick: () => selectedRow && setWithdrawTarget(selectedRow),
                  disabled: working || !canWithdraw,
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
            <AgGridReact<WelBenefitRequestItem>
              theme="legacy"
              rowData={pagedItems}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, resizable: true, filter: false }}
              rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
              animateRows={false}
              getRowId={(params) => String(params.data.id)}
              onRowClicked={(event) => setSelectedRow(event.data ?? null)}
              localeText={{ page: "페이지", noRowsToShow: "신청 내역이 없습니다." }}
              overlayNoRowsTemplate='<span class="text-sm text-slate-400">복리후생 신청 내역이 없습니다.</span>'
              headerHeight={36}
              rowHeight={34}
            />
          </div>
        </ManagerGridSection>
      </ManagerPageShell>

      {/* 신청 다이얼로그 */}
      <ConfirmDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="복리후생 신청"
        confirmLabel="신청"
        cancelLabel="취소"
        confirmVariant="save"
        busy={working}
        onConfirm={handleCreate}
        description={
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">복리후생 유형 *</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createTypeCode}
                onChange={(e) => setCreateTypeCode(e.target.value)}
              >
                <option value="">유형 선택</option>
                {activeTypes.map((t: WelBenefitTypeItem) => (
                  <option key={t.code} value={t.code}>
                    {t.name} ({t.is_deduction ? "공제" : "지급"})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">신청금액 (원) *</label>
              <Input
                type="text"
                placeholder="예: 500000"
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">내용/사유 (선택)</label>
              <Input
                type="text"
                placeholder="신청 내용 또는 사유를 입력하세요"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        }
      />

      {/* 회수 확인 다이얼로그 */}
      <ConfirmDialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
        title="신청 회수"
        description={`${withdrawTarget?.request_no ?? ""} 신청을 회수하시겠습니까? 회수 후에는 되돌릴 수 없습니다.`}
        confirmLabel="회수"
        cancelLabel="취소"
        confirmVariant="destructive"
        busy={working}
        onConfirm={handleWithdraw}
      />
    </>
  );
}
