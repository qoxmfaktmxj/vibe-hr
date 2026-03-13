import { AppShell } from "@/components/layout/app-shell";
import { WelBenefitTypeOverview } from "@/components/wel/wel-benefit-type-overview";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "wel.benefit-types",
} as const;

export default async function WelBenefitTypesPage() {
  await requireMenuAccess("/wel/benefit-types");

  return (
    <AppShell title="복리후생 유형관리" description="복리후생 유형과 급여 연계 기준을 확인합니다.">
      <WelBenefitTypeOverview />
    </AppShell>
  );
}
