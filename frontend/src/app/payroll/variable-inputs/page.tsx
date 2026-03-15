import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { PayVariableInputManager } from "@/components/payroll/pay-variable-input-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.variable-inputs",
} as const;

void GRID_SCREEN;

export default async function PayrollVariableInputsPage() {
  await requireMenuAccess("/payroll/variable-inputs");

  return (
    <AppShell title="월 변동입력 관리" description="월별 수당/공제 변동 입력 관리">
      <AgGridModulesProvider>
        <PayVariableInputManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
