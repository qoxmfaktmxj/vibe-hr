import { AppShell } from "@/components/layout/app-shell";
import { TimMonthCloseManager } from "@/components/tim/tim-month-close-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "custom",
  profile: "standard-v2",
  registryKey: "tim.month-close",
} as const;

export default async function TimMonthClosePage() {
  await requireMenuAccess("/tim/month-close");

  return (
    <AppShell title="근태 월마감" description="월별 근태 마감 현황을 관리합니다.">
      <TimMonthCloseManager />
    </AppShell>
  );
}
