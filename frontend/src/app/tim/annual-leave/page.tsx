import { AnnualLeaveManager } from "@/components/tim/annual-leave-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tim.annual-leave",
} as const;

export default async function Page() {
  await requireMenuAccess("/tim/annual-leave");

  return (
    <AppShell title="연차 관리" description="연차 발생, 사용, 이월, 잔여 현황을 관리합니다.">
      <AnnualLeaveManager />
    </AppShell>
  );
}
