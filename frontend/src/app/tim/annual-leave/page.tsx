import { AnnualLeaveManager } from "@/components/tim/annual-leave-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/annual-leave");

  return (
    <AppShell title="연차관리" description="연차 잔여 조회 및 관리자 조정">
      <AnnualLeaveManager />
    </AppShell>
  );
}
