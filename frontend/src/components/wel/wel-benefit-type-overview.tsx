import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WelBenefitTypeItem } from "@/types/welfare";

type WelBenefitTypeOverviewProps = {
  items: WelBenefitTypeItem[];
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

function TypePill({
  active,
  deduction,
}: {
  active: boolean;
  deduction: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <span
        className={[
          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
          active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600",
        ].join(" ")}
      >
        {active ? "사용" : "비사용"}
      </span>
      <span
        className={[
          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
          deduction ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700",
        ].join(" ")}
      >
        {deduction ? "공제형" : "지급형"}
      </span>
    </div>
  );
}

export function WelBenefitTypeOverview({ items }: WelBenefitTypeOverviewProps) {
  const activeCount = items.filter((item) => item.is_active).length;
  const deductionCount = items.filter((item) => item.is_deduction).length;
  const earningCount = items.length - deductionCount;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="복리후생 유형"
          value={`${items.length}`}
          description="bootstrap seed 기준으로 즉시 확인 가능한 유형 수"
        />
        <SummaryCard
          title="지급 / 공제"
          value={`${earningCount} / ${deductionCount}`}
          description="급여 연계 기준으로 지급형과 공제형을 나눈 결과"
        />
        <SummaryCard
          title="활성 유형"
          value={`${activeCount}`}
          description="실제 메뉴와 샘플 seed에서 바로 노출 가능한 활성 건수"
        />
      </section>

      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/80">
          <CardTitle className="text-lg font-bold text-slate-900">복리후생 유형 샘플 데이터</CardTitle>
          <p className="text-sm text-slate-500">
            메뉴가 추가되면 seed도 함께 들어가야 한다는 현재 정책에 맞춰, 이 화면은 기본 seed
            데이터를 바로 보여준다.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">코드</th>
                  <th className="px-4 py-3 font-semibold">유형명</th>
                  <th className="px-4 py-3 font-semibold">모듈 경로</th>
                  <th className="px-4 py-3 font-semibold">급여 항목</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 text-sm text-slate-700">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">
                      {item.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {BENEFIT_TYPE_LABELS[item.code] ?? item.name}
                      </div>
                      <div className="text-xs text-slate-500">정렬순서 {item.sort_order}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.module_path}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {item.pay_item_code ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <TypePill active={item.is_active} deduction={item.is_deduction} />
                    </td>
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
