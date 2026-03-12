import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WelBenefitRequestItem } from "@/types/welfare";

type WelBenefitRequestOverviewProps = {
  items: WelBenefitRequestItem[];
};

const BENEFIT_TYPE_LABELS: Record<string, string> = {
  SCHOLARSHIP: "학자금",
  CONDOLENCE: "경조금",
  MEDICAL: "의료비",
  LOAN: "사내대출",
  PENSION: "개인연금",
  RESORT: "리조트",
  CLUB: "동호회",
  HEALTH_CHECK: "건강검진",
};

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  draft: { label: "작성중", className: "bg-slate-200 text-slate-700" },
  submitted: { label: "검토대기", className: "bg-blue-100 text-blue-700" },
  approved: { label: "승인", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "반려", className: "bg-rose-100 text-rose-700" },
  payroll_reflected: { label: "급여반영", className: "bg-violet-100 text-violet-700" },
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
    <Card className="border-slate-200 bg-white/95 shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-sm font-semibold text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-3xl font-black tracking-tight text-slate-900">{value}</div>
        <p className="text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

function currency(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function dateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatusPill({ statusCode }: { statusCode: string }) {
  const meta = STATUS_META[statusCode] ?? {
    label: statusCode,
    className: "bg-slate-200 text-slate-700",
  };
  return (
    <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", meta.className].join(" ")}>
      {meta.label}
    </span>
  );
}

export function WelBenefitRequestOverview({ items }: WelBenefitRequestOverviewProps) {
  const submittedCount = items.filter((item) => item.status_code === "submitted").length;
  const approvedCount = items.filter(
    (item) => item.status_code === "approved" || item.status_code === "payroll_reflected",
  ).length;
  const reflectedCount = items.filter((item) => item.status_code === "payroll_reflected").length;
  const reflectedAmount = items
    .filter((item) => item.status_code === "payroll_reflected")
    .reduce((sum, item) => sum + (item.approved_amount ?? 0), 0);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="전체 요청"
          value={`${items.length}`}
          description="복리후생 메뉴에서 바로 확인 가능한 샘플 신청 건수"
        />
        <SummaryCard
          title="검토 대기"
          value={`${submittedCount}`}
          description="인사 또는 급여 담당자의 확인을 기다리는 요청"
        />
        <SummaryCard
          title="승인 완료"
          value={`${approvedCount}`}
          description="승인되어 급여 연계 또는 후속 처리로 넘어간 요청"
        />
        <SummaryCard
          title="급여 반영"
          value={`${currency(reflectedAmount)}원`}
          description={`${reflectedCount}건이 급여 run과 연결된 상태`}
        />
      </section>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/80">
          <CardTitle className="text-lg font-bold text-slate-900">복리후생 신청 샘플 데이터</CardTitle>
          <p className="text-sm text-slate-500">
            메뉴 seed와 함께 들어가는 요청 샘플이다. 신청, 승인, 반려, 급여반영 상태를 한 번에
            확인할 수 있게 구성했다.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">신청번호</th>
                  <th className="px-4 py-3 font-semibold">유형</th>
                  <th className="px-4 py-3 font-semibold">사원</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                  <th className="px-4 py-3 font-semibold">신청금액</th>
                  <th className="px-4 py-3 font-semibold">승인금액</th>
                  <th className="px-4 py-3 font-semibold">급여연계</th>
                  <th className="px-4 py-3 font-semibold">요청일시</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 text-sm text-slate-700">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-slate-700">{item.request_no}</div>
                      <div className="text-xs text-slate-500">{item.description ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {BENEFIT_TYPE_LABELS[item.benefit_type_code] ?? item.benefit_type_name}
                      </div>
                      <div className="font-mono text-xs text-slate-500">{item.benefit_type_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{item.employee_name}</div>
                      <div className="text-xs text-slate-500">
                        {item.employee_no} / {item.department_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill statusCode={item.status_code} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {currency(item.requested_amount)}원
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {currency(item.approved_amount)}
                      {item.approved_amount === null ? "" : "원"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.payroll_run_label ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{dateTime(item.requested_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
