import { AppShell } from "@/components/layout/app-shell";
import { TimReportDashboard } from "@/components/tim/tim-report-dashboard";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/reports");

  return (
    <AppShell title="근태리포트" description="근태/휴가 통계 대시보드">
      <TimReportDashboard />
    </AppShell>
  );
}
