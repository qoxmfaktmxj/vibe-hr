import { AppShell } from "@/components/layout/app-shell";
import { WelBenefitRequestOverview } from "@/components/wel/wel-benefit-request-overview";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "wel.requests",
} as const;

void GRID_SCREEN;

export default async function WelRequestsPage() {
  await requireMenuAccess("/wel/requests");

  return (
    <AppShell title="복리후생 신청현황" description="신청, 승인, 급여 반영 상태를 확인합니다.">
      <WelBenefitRequestOverview />
    </AppShell>
  );
}
