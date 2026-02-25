import { AppShell } from "@/components/layout/app-shell";
import { TimReportDashboard } from "@/components/tim/tim-report-dashboard";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/reports");

  return (
    <AppShell title="근태 리포트" description="Phase 4 통계/리포트 대시보드 (기본 집계)">
      <TimReportDashboard />
    </AppShell>
  );
}
