import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { PayEmployeeProfileManager } from "@/components/payroll/pay-employee-profile-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.employee-profiles",
} as const;

export default async function PayrollEmployeeProfilesPage() {
  await requireMenuAccess("/payroll/employee-profiles");

  return (
    <AppShell title="직원 급여프로필 관리" description="직원별 기본급/급여코드/지급일 규칙 관리">
      <AgGridModulesProvider>
        <PayEmployeeProfileManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
