import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { PayrollRunManager } from "@/components/payroll/payroll-run-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.runs",
} as const;

void GRID_SCREEN;

export default async function PayrollRunsPage() {
  await requireMenuAccess("/payroll/runs");

  return (
    <AppShell
      title="정기급여 Run 관리"
      description="정기급여 계산, 재계산, 마감, 지급완료 상태를 관리합니다."
    >
      <AgGridModulesProvider>
        <PayrollRunManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
