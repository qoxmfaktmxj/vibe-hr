import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayAllowanceDeductionManager } from "@/components/payroll/pay-allowance-deduction-manager";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.allowance-deduction-items",
} as const;

export default async function Page() {
  await requireMenuAccess("/payroll/allowance-deduction-items");

  return (
    <AppShell title="수당공제항목관리" description="기본급, 연장수당 등 개별 수당 및 공제 항목(과세/비과세 기준 등) 관리">
      <AgGridModulesProvider>
        <PayAllowanceDeductionManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
