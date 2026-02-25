import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { WorkScheduleManager } from "@/components/tim/work-schedule-manager";

export default async function TimWorkCodesPage() {
  await requireMenuAccess("/tim/work-codes");

  return (
    <AppShell title="근무코드관리" description="근무 유형별 출퇴근 시간 및 근무 조건 관리">
      <WorkScheduleManager />
    </AppShell>
  );
}
