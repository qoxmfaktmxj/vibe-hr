"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, Receipt } from "lucide-react";
import { toast } from "sonner";

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
  const [payslips, setPayslips] = useState<PayslipSummary[]>([]);
  const [detail, setDetail] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pay/my/payslips", { cache: "no-store" });
      if (!res.ok) throw new Error("급여 목록 조회 실패");
      const data = (await res.json()) as { items: PayslipSummary[]; total_count: number };
      setPayslips(data.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPayslips();
  }, [fetchPayslips]);

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
                <span className="text-xs text-slate-400">({summary.run_name})</span>
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

  // ── List View ──
  return (
    <ManagerPageShell>
      <ManagerGridSection
        headerLeft={
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">내 급여 이력</span>
            <span className="text-xs text-slate-400">({payslips.length}건)</span>
          </div>
        }
        contentClassName="px-3 pb-4 pt-2 md:px-6 md:pt-2"
      >
        {loading || detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-slate-400">불러오는 중...</p>
          </div>
        ) : payslips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Receipt className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-400">조회 가능한 급여 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 pl-4 text-left font-medium text-slate-600">급여월</th>
                  <th className="py-2.5 text-left font-medium text-slate-600">구분</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">지급합계</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">공제합계</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">실수령액</th>
                  <th className="py-2.5 text-center font-medium text-slate-600">상태</th>
                  <th className="py-2.5 pr-4 text-right font-medium text-slate-600">지급일</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((ps) => (
                  <tr
                    key={ps.run_employee_id}
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50"
                    onClick={() => void openDetail(ps.run_id)}
                  >
                    <td className="py-3 pl-4 font-medium text-slate-700">
                      {parseYearMonth(ps.year_month)}
                    </td>
                    <td className="py-3 text-slate-500">{ps.run_name ?? "-"}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-green-700">
                      {formatCurrency(ps.gross_pay)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-red-600">
                      {formatCurrency(ps.total_deductions)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums font-semibold text-blue-700">
                      {formatCurrency(ps.net_pay)}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          ps.run_status === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {ps.run_status === "paid" ? "지급완료" : "확정"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-xs text-slate-400">
                      {ps.paid_at ? new Date(ps.paid_at).toLocaleDateString("ko-KR") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ManagerGridSection>
    </ManagerPageShell>
  );
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
        highlight ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${color}`}>
        {formatCurrency(amount)}
        <span className="ml-0.5 text-xs font-normal text-slate-400">원</span>
      </div>
    </div>
  );
}
