import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { PayrollRunManager } from "@/components/payroll/payroll-run-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.runs",
} as const;

export default async function PayrollRunsPage() {
  await requireMenuAccess("/payroll/runs");

  return (
    <AppShell title="월 급여 Run 관리" description="월 급여 계산/마감/지급완료 상태 관리">
      <AgGridModulesProvider>
        <PayrollRunManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
