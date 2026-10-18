"use client";

import { useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

import { LocalReadonlyGrid } from "@/components/grid/readonly-grid-manager";
import { ManagerGridSection, ManagerPageShell } from "@/components/grid/manager-layout";
import { Button } from "@/components/ui/button";

// ── Types ──

type PayslipSummary = {
  run_id: number;
  run_employee_id: number;
  year_month: string;
  run_name: string | null;
  run_status: string;
  gross_pay: number;
  taxable_income: number;
  non_taxable_income: number;
  total_deductions: number;
  net_pay: number;
  paid_at: string | null;
};

type PayslipDetailItem = {
  id: number;
  run_employee_id: number;
  item_code: string;
  item_name: string;
  direction: string;
  amount: number;
  tax_type: string;
  calculation_type: string;
  source_type: string;
  created_at: string;
};

type PayslipDetail = {
  summary: PayslipSummary;
  items: PayslipDetailItem[];
};

// ── Helpers ──

function formatCurrency(amount: number): string {
  return amount.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function parseYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}

// ── Component ──

export function MyPayslipViewer() {
  const { data, error, isLoading: loading, mutate } = useSWR<{ items: PayslipSummary[]; total_count: number }>("/api/pay/my/payslips", fetcher, { revalidateOnFocus: false });
  const payslips = data?.items ?? [];
  const [detail, setDetail] = useState<PayslipDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openDetail(runId: number) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/pay/my/payslips/${runId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("급여 상세 조회 실패");
      const data = (await res.json()) as PayslipDetail;
      setDetail(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상세 조회 실패");
    } finally {
      setDetailLoading(false);
    }
  }

  async function downloadPdf(runId: number) {
    try {
      const res = await fetch(`/api/pay/my/payslips/${runId}/pdf`, { cache: "no-store" });
      if (!res.ok) throw new Error("PDF 다운로드 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${detail?.summary.year_month ?? runId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF 다운로드 실패");
    }
  }

  // ── Detail View ──
  if (detail) {
    const { summary, items } = detail;
    const earnings = items.filter((i) => i.direction === "earning");
    const deductions = items.filter((i) => i.direction === "deduction");

    return (
      <ManagerPageShell>
        <ManagerGridSection
          headerLeft={
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                목록
              </Button>
              <span className="text-sm font-medium text-foreground">
                {parseYearMonth(summary.year_month)} 급여 상세
              </span>
              {summary.run_name && (
                <span className="text-xs text-muted-foreground">({summary.run_name})</span>
              )}
            </div>
          }
          headerRight={
            <Button variant="outline" size="sm" onClick={() => void downloadPdf(summary.run_id)}>
              <Download className="mr-1 h-3.5 w-3.5" />
              PDF 다운로드
            </Button>
          }
          contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-2"
        >
          {/* 요약 카드 */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="지급합계" amount={summary.gross_pay} color="text-green-700" />
            <SummaryCard label="공제합계" amount={summary.total_deductions} color="text-red-600" />
            <SummaryCard label="실수령액" amount={summary.net_pay} color="text-blue-700" highlight />
            <SummaryCard label="과세소득" amount={summary.taxable_income} color="text-muted-foreground" />
          </div>

          {/* 수당 테이블 */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-foreground">수당 내역</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="py-2 pl-4 text-left font-medium text-muted-foreground">항목코드</th>
                  <th className="py-2 text-left font-medium text-muted-foreground">항목명</th>
                  <th className="py-2 text-left font-medium text-muted-foreground">과세구분</th>
                  <th className="py-2 pr-4 text-right font-medium text-muted-foreground">금액</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-2 pl-4 text-muted-foreground">{item.item_code}</td>
                    <td className="py-2 text-foreground">{item.item_name}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {item.tax_type === "taxable" ? "과세" : "비과세"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium text-green-700">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-green-50">
                  <td colSpan={3} className="py-2 pl-4 font-semibold text-foreground">지급합계</td>
                  <td className="py-2 pr-4 text-right tabular-nums font-semibold text-green-700">
                    {formatCurrency(summary.gross_pay)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 공제 테이블 */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">공제 내역</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="py-2 pl-4 text-left font-medium text-muted-foreground">항목코드</th>
                  <th className="py-2 text-left font-medium text-muted-foreground">항목명</th>
                  <th className="py-2 text-left font-medium text-muted-foreground">공제구분</th>
                  <th className="py-2 pr-4 text-right font-medium text-muted-foreground">금액</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-2 pl-4 text-muted-foreground">{item.item_code}</td>
                    <td className="py-2 text-foreground">{item.item_name}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {item.tax_type === "insurance" ? "보험" : item.tax_type === "tax" ? "세금" : item.tax_type}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium text-red-600">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-red-50">
                  <td colSpan={3} className="py-2 pl-4 font-semibold text-foreground">공제합계</td>
                  <td className="py-2 pr-4 text-right tabular-nums font-semibold text-red-600">
                    {formatCurrency(summary.total_deductions)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ManagerGridSection>
      </ManagerPageShell>
    );
  }

  return <div className="business-workspace">{error && <p role="alert" className="mb-3 text-sm text-destructive">급여 목록을 불러오지 못했습니다. 조회를 눌러 다시 시도해 주세요.</p>}<LocalReadonlyGrid title="내 급여 이력" items={payslips} rowId={row => row.run_employee_id} loading={loading || detailLoading} disabled={detailLoading} onQuery={() => void mutate()} gridHeight={420} emptyText="조회 가능한 급여 내역이 없습니다." onRowClick={row => { if (!detailLoading) void openDetail(row.run_id); }} columns={[
    { field: "year_month", headerName: "급여월", minWidth: 150, valueFormatter: p => parseYearMonth(p.value) },
    { field: "run_name", headerName: "구분", minWidth: 160, flex: 1 },
    { field: "gross_pay", headerName: "지급합계", minWidth: 150, cellClass: "text-right", valueFormatter: p => formatCurrency(p.value) },
    { field: "total_deductions", headerName: "공제합계", minWidth: 150, cellClass: "text-right", valueFormatter: p => formatCurrency(p.value) },
    { field: "net_pay", headerName: "실수령액", minWidth: 150, cellClass: "text-right font-semibold", valueFormatter: p => formatCurrency(p.value) },
    { field: "run_status", headerName: "상태", valueFormatter: p => p.value === "paid" ? "지급완료" : "확정" },
    { field: "paid_at", headerName: "지급일", minWidth: 140, valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString("ko-KR") : "-" },
  ]} /><p className="mt-3 text-xs text-muted-foreground">월별 내역을 클릭하거나 Enter를 누르면 명세서를 확인할 수 있습니다.</p></div>;
}

// ── Summary Card ──

function SummaryCard({
  label,
  amount,
  color,
  highlight,
}: {
  label: string;
  amount: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-blue-200 bg-blue-50" : "border-border bg-background"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${color}`}>
        {formatCurrency(amount)}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">원</span>
      </div>
    </div>
  );
}
