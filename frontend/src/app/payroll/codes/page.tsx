import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayrollCodeManager } from "@/components/payroll/payroll-code-manager";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "payroll.codes",
} as const;

export default async function Page() {
  await requireMenuAccess("/payroll/codes");

  return (
    <AppShell title="급여코드관리" description="급여 지급의 성격과 주기를 정의하는 급여코드 관리">
      <AgGridModulesProvider>
        <PayrollCodeManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
