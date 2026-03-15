import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { DepartmentScheduleAssignmentManager } from "@/components/tim/department-schedule-assignment-manager";
import { EmployeeScheduleExceptionManager } from "@/components/tim/employee-schedule-exception-manager";
import { ScheduleGeneratorManager } from "@/components/tim/schedule-generator-manager";
import { WorkScheduleManager } from "@/components/tim/work-schedule-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tim.work-schedules",
} as const;

void GRID_SCREEN;

export default async function TimWorkCodesPage() {
  await requireMenuAccess("/tim/work-codes");

  return (
    <AppShell
      title="근무코드 관리"
      description="근무코드, 조직 기본 근무, 개인 예외 근무조를 함께 관리합니다."
    >
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ScheduleGeneratorManager />
          <DepartmentScheduleAssignmentManager />
          <EmployeeScheduleExceptionManager />
        </div>
        <AgGridModulesProvider>
          <WorkScheduleManager />
        </AgGridModulesProvider>
      </div>
    </AppShell>
  );
}
