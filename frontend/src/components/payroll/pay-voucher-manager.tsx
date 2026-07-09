"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { VibeGrid } from "@/components/grid/vibe-grid";
import type { ReadonlyGridRow } from "@/components/grid/readonly-grid-manager";
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

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
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

export function PayVoucherManager() {
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);
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
    { revalidateOnFocus: false },
  );

  async function mutateAllVoucherLists() {
    await mutateVouchers();
    await globalMutate((key) => typeof key === "string" && key.startsWith("/api/pay/vouchers?"));
  }

  const detailKey = selectedVoucherId ? `/api/pay/vouchers/${selectedVoucherId}` : null;
  const { data: voucherDetail, mutate: mutateVoucherDetail } = useSWR<PayVoucherDetailResponse>(
    detailKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const runs = useMemo(() => runData?.items ?? [], [runData?.items]);
  const voucherItems = useMemo(() => voucherData?.items ?? [], [voucherData?.items]);
  const firstVoucherId = voucherItems[0]?.id ?? null;

  const voucherColumns = useMemo<ColDef<VoucherRow>[]>(
    () => [
      { field: "voucher_no", headerName: "전표번호", width: 160 },
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

  useEffect(() => {
    if (voucherItems.length === 0) {
      if (selectedVoucherId !== null) setSelectedVoucherId(null);
      return;
    }
    if (selectedVoucherId && voucherItems.some((item) => item.id === selectedVoucherId)) return;
    setSelectedVoucherId(firstVoucherId);
  }, [voucherItems, firstVoucherId, selectedVoucherId]);

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
    <div className="space-y-4 px-4 py-4">
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

      <VibeGrid<PayVoucherItem>
        registryKey="payroll.vouchers"
        title="급여 전표 목록"
        description="생성된 급여 전표 목록. 행을 클릭하면 아래에서 상세 라인과 확정/취소 처리를 할 수 있습니다."
        variant="readonly"
        columns={voucherColumns}
        fetchUrl="/api/pay/vouchers"
        pageSize={50}
        emptyText="등록된 급여 전표가 없습니다."
        downloadFileName="payroll-vouchers"
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
                <div className="font-medium">{voucherDetail.voucher.voucher_no}</div>
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

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">라인</th>
                      <th className="px-3 py-2 text-left">계정</th>
                      <th className="px-3 py-2 text-left">코스트센터</th>
                      <th className="px-3 py-2 text-right">차변</th>
                      <th className="px-3 py-2 text-right">대변</th>
                      <th className="px-3 py-2 text-left">요약</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucherDetail.lines.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                          라인 데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      voucherDetail.lines.map((line) => (
                        <tr key={line.id} className="border-t">
                          <td className="px-3 py-2">{line.line_no}</td>
                          <td className="px-3 py-2">
                            {line.gl_account_code}
                            {line.gl_account_name ? ` (${line.gl_account_name})` : ""}
                          </td>
                          <td className="px-3 py-2">{line.cost_center_code ?? "-"}</td>
                          <td className="px-3 py-2 text-right">{formatAmount(line.debit_amount)}</td>
                          <td className="px-3 py-2 text-right">{formatAmount(line.credit_amount)}</td>
                          <td className="px-3 py-2">{line.summary ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

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
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
