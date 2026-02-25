import { AppShell } from "@/components/layout/app-shell";
import { EmployeeScheduleExceptionManager } from "@/components/tim/employee-schedule-exception-manager";
import { ScheduleGeneratorManager } from "@/components/tim/schedule-generator-manager";
import { WorkScheduleManager } from "@/components/tim/work-schedule-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function TimWorkCodesPage() {
  await requireMenuAccess("/tim/work-codes");

  return (
    <AppShell title="근무코드관리" description="근무 유형별 출퇴근 시간 및 근무 조건 관리">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ScheduleGeneratorManager />
          <EmployeeScheduleExceptionManager />
        </div>
        <WorkScheduleManager />
      </div>
    </AppShell>
  );
}
