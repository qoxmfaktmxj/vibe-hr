import { AppShell } from "@/components/layout/app-shell";
import { TimMonthCloseManager } from "@/components/tim/tim-month-close-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "tim.month-closing",
} as const;

export default async function TimMonthClosingPage() {
  await requireMenuAccess("/tim/month-closing");

  return (
    <AppShell title="근태 월마감" description="월별 근태 마감 현황을 관리합니다.">
      <TimMonthCloseManager />
    </AppShell>
  );
}
