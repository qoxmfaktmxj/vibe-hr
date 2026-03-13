import { AppShell } from "@/components/layout/app-shell";
import { TimReportDashboard } from "@/components/tim/tim-report-dashboard";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tim.reports",
} as const;

export default async function Page() {
  await requireMenuAccess("/tim/reports");

  return (
    <AppShell title="근태 리포트" description="근태와 휴가 통계를 확인합니다.">
      <TimReportDashboard />
    </AppShell>
  );
}
