"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import {
  ReadonlyGridManager,
  LocalReadonlyGrid,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";
import type { PayPayrollRunItem } from "@/types/pay";
import type {
  PayVoucherDetailResponse,
  PayVoucherItem,
  PayVoucherListResponse,
} from "@/types/pay-voucher";

type VoucherRow = PayVoucherItem & ReadonlyGridRow;

const STATUS_LABELS: Record<string, string> = {
  draft: "임시",
  confirmed: "확정",
  cancelled: "취소",
};

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  accrual: "미지급(accrual)",
  disbursement: "지급(disbursement)",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function voucherTypeLabel(voucherType: string): string {
  return VOUCHER_TYPE_LABELS[voucherType] ?? voucherType;
}

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const json = (await response.json()) as { detail?: string };
    return json.detail ?? fallback;
  } catch {
    return fallback;
  }
}

async function downloadRowsAsXlsx(rows: VoucherRow[], columns: ColDef<VoucherRow>[]) {
  const visibleColumns = columns.filter((column) => column.field || column.valueGetter);
  const headers = visibleColumns.map((column) => column.headerName ?? String(column.field ?? ""));
  const data = rows.map((row) =>
    visibleColumns.map((column) => {
      const value = column.field ? row[column.field as keyof VoucherRow] : "";
      if (typeof column.valueFormatter === "function") {
        return (column.valueFormatter as (params: { value: unknown; data: VoucherRow }) => string)({
          value,
          data: row,
        });
      }
      return value ?? "";
    }),
  );
  const { utils, writeFileXLSX } = await import("xlsx");
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([headers, ...data]), "급여 전표 목록");
  writeFileXLSX(workbook, `payroll-vouchers-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function PayVoucherManager() {
  const [requestedVoucherId, setSelectedVoucherId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mutate: globalMutate } = useSWRConfig();
  const { data: runData } = useSWR<{ items: PayPayrollRunItem[]; total_count: number }>(
    "/api/pay/runs?all=true",
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: voucherData, mutate: mutateVouchers } = useSWR<PayVoucherListResponse>(
    "/api/pay/vouchers",
    fetcher,
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (isSubmitting) return;
        setSelectedVoucherId((previous) => data.items.some((item) => item.id === previous) ? previous : data.items[0]?.id ?? null);
      },
    },
  );
  const pageSize = 50;
  const pagedVoucherKey = `/api/pay/vouchers?page=${page}&limit=${pageSize}`;
  const { data: pagedVoucherData, isLoading: isPagedVoucherLoading, mutate: mutatePagedVouchers } =
    useSWR<PayVoucherListResponse>(pagedVoucherKey, fetcher, { revalidateOnFocus: false });

  async function mutateAllVoucherLists() {
    await mutateVouchers();
    await globalMutate((key) => typeof key === "string" && key.startsWith("/api/pay/vouchers?"));
  }

  const runs = useMemo(() => runData?.items ?? [], [runData?.items]);
  const voucherItems = useMemo(() => voucherData?.items ?? [], [voucherData?.items]);
  const selectedVoucherId = (isSubmitting && requestedVoucherId !== null) || voucherItems.some((item) => item.id === requestedVoucherId)
    ? requestedVoucherId
    : voucherItems[0]?.id ?? null;
  const detailKey = selectedVoucherId ? `/api/pay/vouchers/${selectedVoucherId}` : null;
  const { data: voucherDetail, mutate: mutateVoucherDetail } = useSWR<PayVoucherDetailResponse>(
    detailKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const voucherRows = useMemo<VoucherRow[]>(
    () => createReadonlyGridRows(pagedVoucherData?.items ?? []),
    [pagedVoucherData?.items],
  );
  const voucherRunId = voucherDetail?.voucher.run_id;
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === voucherRunId) ?? null,
    [runs, voucherRunId],
  );
  const canGenerateDisbursement =
    !!voucherDetail &&
    voucherDetail.voucher.voucher_type === "accrual" &&
    voucherDetail.voucher.status === "confirmed" &&
    selectedRun?.status === "paid";

  const voucherColumns = useMemo<ColDef<VoucherRow>[]>(
    () => [
      { field: "voucher_no", headerName: "전표번호", width: 160 },
      {
        field: "voucher_type",
        headerName: "전표유형",
        width: 150,
        valueFormatter: (params) => voucherTypeLabel(String(params.value ?? "")),
      },
      { field: "run_id", headerName: "Run ID", width: 90 },
      { field: "year_month", headerName: "귀속월", width: 100 },
      { field: "voucher_date", headerName: "전표일자", width: 120 },
      {
        field: "total_debit",
        headerName: "차변합",
        width: 150,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => formatAmount(Number(params.value ?? 0)),
      },
      {
        field: "total_credit",
        headerName: "대변합",
        width: 150,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => formatAmount(Number(params.value ?? 0)),
      },
      {
        field: "status",
        headerName: "상태",
        width: 100,
        valueFormatter: (params) => statusLabel(String(params.value ?? "")),
      },
      {
        field: "created_at",
        headerName: "생성일",
        width: 130,
        valueFormatter: (params) => String(params.value ?? "").slice(0, 10),
      },
    ],
    [],
  );

  async function handleGenerateVoucher() {
    if (!selectedRunId) {
      toast.error("급여 Run을 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/pay/vouchers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: Number(selectedRunId) }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "전표 생성에 실패했습니다."));
      }

      const created = (await response.json()) as { voucher: PayVoucherItem };
      setSelectedVoucherId(created.voucher.id);
      await mutateAllVoucherLists();
      toast.success("급여 전표가 생성되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "전표 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateDisbursementVoucher() {
    if (!voucherDetail) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/pay/vouchers/generate-disbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: voucherDetail.voucher.run_id }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "지급전표 생성에 실패했습니다."));
      }

      const created = (await response.json()) as { voucher: PayVoucherItem };
      setSelectedVoucherId(created.voucher.id);
      await mutateAllVoucherLists();
      toast.success("지급전표가 생성되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "지급전표 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDownloadCsv() {
    if (!voucherDetail) return;
    try {
      const response = await fetch(`/api/pay/vouchers/${voucherDetail.voucher.id}/export?format=csv`);
      if (!response.ok) {
        throw new Error(await parseError(response, "CSV 다운로드에 실패했습니다."));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${voucherDetail.voucher.voucher_no}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV 다운로드에 실패했습니다.");
    }
  }

  async function handleConfirmVoucher() {
    if (!voucherDetail) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/pay/vouchers/${voucherDetail.voucher.id}/confirm`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "전표 확정에 실패했습니다."));
      }
      await mutateVoucherDetail();
      await mutateAllVoucherLists();
      toast.success("전표가 확정되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "전표 확정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelVoucher() {
    if (!voucherDetail) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/pay/vouchers/${voucherDetail.voucher.id}/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "전표 취소에 실패했습니다."));
      }
      await mutateVoucherDetail();
      await mutateAllVoucherLists();
      toast.success("전표가 취소되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "전표 취소에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="business-workspace space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>급여 전표 생성</CardTitle>
          <CardDescription>급여 Run을 선택해 GL 전표를 생성합니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select
            className="h-9 rounded-md border px-3 text-sm"
            value={selectedRunId}
            onChange={(event) => setSelectedRunId(event.target.value)}
            disabled={isSubmitting}
          >
            <option value="">급여 Run 선택</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.year_month} | {run.run_name ?? run.payroll_code_name ?? `Run #${run.id}`} | {statusLabel(run.status)}
              </option>
            ))}
          </select>
          <Button onClick={handleGenerateVoucher} disabled={isSubmitting}>
            전표 생성
          </Button>
        </CardContent>
      </Card>

      <ReadonlyGridManager<VoucherRow>
        embedded inset gridHeight={320}
        title="급여 전표 목록"
        searchFields={null}
        rowData={voucherRows}
        columnDefs={voucherColumns}
        totalCount={pagedVoucherData?.total_count ?? 0}
        page={(pagedVoucherData as (PayVoucherListResponse & { page?: number }) | undefined)?.page ?? page}
        pageSize={(pagedVoucherData as (PayVoucherListResponse & { limit?: number }) | undefined)?.limit ?? pageSize}
        onPageChange={setPage}
        onQuery={() => {
          setPage(1);
          void mutatePagedVouchers();
        }}
        onDownload={() => void downloadRowsAsXlsx(voucherRows, voucherColumns)}
        queryDisabled={isPagedVoucherLoading}
        loading={isPagedVoucherLoading}
        emptyText="등록된 급여 전표가 없습니다."
        onRowClick={(row) => setSelectedVoucherId(row.id as number)}
        selectedRowId={selectedVoucherId}
      />

      <Card>
        <CardHeader>
          <CardTitle>전표 상세</CardTitle>
          <CardDescription>전표 라인 내역 확인 후 확정 또는 취소를 수행합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {!voucherDetail ? (
            <p className="text-sm text-muted-foreground">위 목록에서 전표를 선택해 주세요.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {voucherDetail.voucher.voucher_no}
                  <Badge variant={voucherDetail.voucher.voucher_type === "disbursement" ? "secondary" : "outline"}>
                    {voucherTypeLabel(voucherDetail.voucher.voucher_type)}
                  </Badge>
                </div>
                <div className="mt-1 text-muted-foreground">
                  Run #{voucherDetail.voucher.run_id} | {voucherDetail.voucher.year_month ?? "-"} | 전표일자{" "}
                  {voucherDetail.voucher.voucher_date}
                </div>
                <div className="mt-1">
                  상태: {statusLabel(voucherDetail.voucher.status)} | 차변합{" "}
                  {formatAmount(voucherDetail.voucher.total_debit)} | 대변합{" "}
                  {formatAmount(voucherDetail.voucher.total_credit)}
                </div>
                {voucherDetail.voucher.summary ? (
                  <div className="mt-1 text-muted-foreground">{voucherDetail.voucher.summary}</div>
                ) : null}
              </div>

              <LocalReadonlyGrid title="전표 라인" items={voucherDetail.lines} rowId={row => row.id} columns={[
                  { field: "line_no", headerName: "라인", width: 80 },
                  { field: "gl_account_code", headerName: "계정", minWidth: 200, valueFormatter: p => `${p.value ?? ""}${p.data?.gl_account_name ? ` (${p.data.gl_account_name})` : ""}` },
                  { field: "cost_center_code", headerName: "코스트센터", minWidth: 150 },
                  { field: "debit_amount", headerName: "차변", minWidth: 150, cellClass: "text-right", valueFormatter: p => formatAmount(p.value) },
                  { field: "credit_amount", headerName: "대변", minWidth: 150, cellClass: "text-right", valueFormatter: p => formatAmount(p.value) },
                  { field: "summary", headerName: "요약", minWidth: 180, flex: 1 },
                ]} emptyText="조회된 상세 내역이 없습니다." />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleConfirmVoucher}
                  disabled={isSubmitting || voucherDetail.voucher.status !== "draft"}
                >
                  전표 확정
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancelVoucher}
                  disabled={isSubmitting || voucherDetail.voucher.status !== "confirmed"}
                >
                  전표 취소
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadCsv}
                  disabled={voucherDetail.voucher.status !== "confirmed"}
                >
                  CSV 다운로드
                </Button>
                {voucherDetail.voucher.voucher_type === "accrual" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateDisbursementVoucher}
                    disabled={isSubmitting || !canGenerateDisbursement}
                  >
                    지급전표 생성
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
