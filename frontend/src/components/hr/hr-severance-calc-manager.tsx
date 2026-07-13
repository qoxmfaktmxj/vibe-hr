"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { VibeGrid } from "@/components/grid/vibe-grid";
import type { ReadonlyGridRow } from "@/components/grid/readonly-grid-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type {
  HrSeveranceCalcDetailResponse,
  HrSeveranceCalcItem,
  HrSeveranceCalcListResponse,
} from "@/types/hr-severance";

const TAX_ROW_LABELS: { key: keyof import("@/types/hr-severance").HrSeveranceTaxDetail; label: string }[] = [
  { key: "service_year_deduction", label: "근속연수공제" },
  { key: "conversion_income", label: "환산급여" },
  { key: "conversion_income_deduction", label: "환산급여공제" },
  { key: "taxable_base", label: "과세표준" },
  { key: "income_tax", label: "산출세액" },
  { key: "local_income_tax", label: "지방소득세" },
  { key: "net_severance", label: "실수령액" },
];

type SeveranceCalcRow = HrSeveranceCalcItem & ReadonlyGridRow;

const STATUS_LABELS: Record<string, string> = {
  draft: "산정중",
  confirmed: "확정",
};

const INCLUDE_TYPE_LABELS: Record<string, string> = {
  full: "전액산입",
  prorate_12: "12분의1산입",
  exclude: "제외",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatAmount(value: number): string {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const json = (await response.json()) as { detail?: string };
    return json.detail ?? fallback;
  } catch {
    return fallback;
  }
}

export function HrSeveranceCalcManager() {
  const [selectedCalcId, setSelectedCalcId] = useState<number | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>("0");
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mutate: globalMutate } = useSWRConfig();
  const { data: calcData, mutate: mutateCalcs } = useSWR<HrSeveranceCalcListResponse>(
    "/api/hr/severance/calcs",
    fetcher,
    { revalidateOnFocus: false },
  );

  async function mutateAllCalcLists() {
    await mutateCalcs();
    await globalMutate((key) => typeof key === "string" && key.startsWith("/api/hr/severance/calcs?"));
  }

  const detailKey = selectedCalcId ? `/api/hr/severance/calcs/${selectedCalcId}` : null;
  const { data: calcDetail, mutate: mutateCalcDetail } = useSWR<HrSeveranceCalcDetailResponse>(
    detailKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const calcItems = useMemo(() => calcData?.items ?? [], [calcData?.items]);
  const firstCalcId = calcItems[0]?.id ?? null;

  const calcColumns = useMemo<ColDef<SeveranceCalcRow>[]>(
    () => [
      { field: "employee_no", headerName: "사번", width: 110 },
      { field: "employee_name", headerName: "성명", width: 110 },
      { field: "retire_date", headerName: "퇴직일", width: 120 },
      { field: "service_days", headerName: "근속일", width: 90, cellStyle: { textAlign: "right" } },
      {
        field: "avg_daily_wage",
        headerName: "평균임금",
        width: 130,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => formatAmount(Number(params.value ?? 0)),
      },
      {
        field: "severance_amount",
        headerName: "산정액",
        width: 140,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => formatAmount(Number(params.value ?? 0)),
      },
      {
        field: "adjustment_amount",
        headerName: "조정액",
        width: 120,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => formatAmount(Number(params.value ?? 0)),
      },
      {
        field: "final_amount",
        headerName: "최종액",
        width: 140,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => formatAmount(Number(params.value ?? 0)),
      },
      {
        field: "income_tax",
        headerName: "소득세",
        width: 130,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => formatAmount(Number(params.value ?? 0)),
      },
      {
        field: "net_severance",
        headerName: "실수령액",
        width: 140,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => formatAmount(Number(params.value ?? 0)),
      },
      {
        field: "status",
        headerName: "상태",
        width: 90,
        valueFormatter: (params) => statusLabel(String(params.value ?? "")),
      },
    ],
    [],
  );

  useEffect(() => {
    if (calcItems.length === 0) {
      if (selectedCalcId !== null) setSelectedCalcId(null);
      return;
    }
    if (selectedCalcId && calcItems.some((item) => item.id === selectedCalcId)) return;
    setSelectedCalcId(firstCalcId);
  }, [calcItems, firstCalcId, selectedCalcId]);

  useEffect(() => {
    if (!calcDetail) {
      setAdjustmentAmount("0");
      setAdjustmentReason("");
      return;
    }
    setAdjustmentAmount(String(calcDetail.calc.adjustment_amount));
    setAdjustmentReason(calcDetail.calc.adjustment_reason ?? "");
  }, [calcDetail]);

  async function handleRecalculate() {
    if (!calcDetail) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/hr/severance/calcs/${calcDetail.calc.id}/recalculate`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "재산정에 실패했습니다."));
      }
      const updated = (await response.json()) as HrSeveranceCalcDetailResponse;
      await mutateCalcDetail(updated, { revalidate: false });
      await mutateAllCalcLists();
      toast.success("퇴직금이 재산정되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "재산정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveAdjustment() {
    if (!calcDetail) return;
    const amount = Number(adjustmentAmount);
    if (Number.isNaN(amount)) {
      toast.error("조정액은 숫자로 입력해 주세요.");
      return;
    }
    if (!adjustmentReason.trim()) {
      toast.error("조정 사유를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/hr/severance/calcs/${calcDetail.calc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustment_amount: amount,
          adjustment_reason: adjustmentReason.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "조정액 저장에 실패했습니다."));
      }
      const updated = (await response.json()) as HrSeveranceCalcDetailResponse;
      await mutateCalcDetail(updated, { revalidate: false });
      await mutateAllCalcLists();
      toast.success("조정액이 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "조정액 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmCalc() {
    if (!calcDetail) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/hr/severance/calcs/${calcDetail.calc.id}/confirm`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "퇴직금 확정에 실패했습니다."));
      }
      const updated = (await response.json()) as HrSeveranceCalcDetailResponse;
      await mutateCalcDetail(updated, { revalidate: false });
      await mutateAllCalcLists();
      toast.success("퇴직금 산정이 확정되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "퇴직금 확정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDraft = calcDetail?.calc.status === "draft";

  return (
    <div className="space-y-4 px-4 py-4">
      <VibeGrid<HrSeveranceCalcItem>
        registryKey="hr.severance.calcs"
        title="퇴직금 산정 목록"
        description="퇴직 확정된 대상자의 퇴직금 산정 목록. 행을 클릭하면 아래에서 산정 근거 확인 및 조정/확정 처리를 할 수 있습니다."
        variant="readonly"
        columns={calcColumns}
        fetchUrl="/api/hr/severance/calcs"
        pageSize={50}
        emptyText="등록된 퇴직금 산정 건이 없습니다."
        downloadFileName="hr-severance-calcs"
        onRowClick={(row) => setSelectedCalcId(row.id as number)}
        selectedRowId={selectedCalcId}
      />

      <Card>
        <CardHeader>
          <CardTitle>퇴직금 산정 상세</CardTitle>
          <CardDescription>산정 근거 확인 후 조정액을 입력하고 재산정 또는 확정을 수행합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {!calcDetail ? (
            <p className="text-sm text-muted-foreground">위 목록에서 산정 건을 선택해 주세요.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">
                  {calcDetail.calc.employee_name} ({calcDetail.calc.employee_no})
                </div>
                <div className="mt-1 text-muted-foreground">{calcDetail.calc.department_name}</div>
                <div className="mt-1">
                  입사일 {calcDetail.calc.hire_date} | 퇴직일 {calcDetail.calc.retire_date} | 근속일{" "}
                  {calcDetail.calc.service_days}일
                </div>
                <div className="mt-1">
                  평균임금 산정기간: {calcDetail.calc.avg_wage_base_from ?? "-"} ~{" "}
                  {calcDetail.calc.avg_wage_base_to ?? "-"}
                </div>
                <div className="mt-1">
                  3개월 임금합계 {formatAmount(calcDetail.calc.wage_total_3m)} / 기준일수{" "}
                  {calcDetail.calc.base_days_3m}일 / 1일 평균임금{" "}
                  {formatAmount(calcDetail.calc.avg_daily_wage)}
                </div>
                <div className="mt-1">
                  산정액 {formatAmount(calcDetail.calc.severance_amount)} | 최종액{" "}
                  {formatAmount(calcDetail.calc.final_amount)} | 상태 {statusLabel(calcDetail.calc.status)}
                </div>
                {calcDetail.calc.warning ? (
                  <div className="mt-1 text-amber-600">경고: {calcDetail.calc.warning}</div>
                ) : null}
              </div>

              {calcDetail.tax_detail ? (
                <div className="rounded-md border p-3 text-sm">
                  <div className="mb-2 font-medium">퇴직소득세 산출 내역</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {TAX_ROW_LABELS.map(({ key, label }) => (
                        <tr key={key} className="border-t first:border-t-0">
                          <td className="px-3 py-1.5 text-muted-foreground">{label}</td>
                          <td className="px-3 py-1.5 text-right font-medium">
                            {formatAmount(Number(calcDetail.tax_detail?.[key] ?? 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">항목코드</th>
                      <th className="px-3 py-2 text-left">항목명</th>
                      <th className="px-3 py-2 text-left">산입구분</th>
                      <th className="px-3 py-2 text-right">원금액</th>
                      <th className="px-3 py-2 text-right">산입금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calcDetail.wage_details.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                          산정 근거 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      calcDetail.wage_details.map((detail) => (
                        <tr key={detail.item_code} className="border-t">
                          <td className="px-3 py-2">{detail.item_code}</td>
                          <td className="px-3 py-2">{detail.item_name ?? "-"}</td>
                          <td className="px-3 py-2">
                            {INCLUDE_TYPE_LABELS[detail.include_type] ?? detail.include_type}
                          </td>
                          <td className="px-3 py-2 text-right">{formatAmount(detail.raw_amount)}</td>
                          <td className="px-3 py-2 text-right">{formatAmount(detail.included_amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">조정액</div>
                  <Input
                    type="number"
                    value={adjustmentAmount}
                    onChange={(event) => setAdjustmentAmount(event.target.value)}
                    disabled={isSubmitting || !isDraft}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <div className="text-xs text-muted-foreground">조정 사유</div>
                  <Input
                    value={adjustmentReason}
                    onChange={(event) => setAdjustmentReason(event.target.value)}
                    placeholder="조정 사유를 입력해 주세요."
                    disabled={isSubmitting || !isDraft}
                  />
                </div>
                <div className="md:col-span-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAdjustment}
                    disabled={isSubmitting || !isDraft}
                  >
                    조정액 저장
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleRecalculate} disabled={isSubmitting || !isDraft}>
                  재산정
                </Button>
                <Button type="button" onClick={handleConfirmCalc} disabled={isSubmitting || !isDraft}>
                  퇴직금 확정
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
