import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayGlAccountManager } from "@/components/payroll/pay-gl-account-manager";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.gl-accounts",
} as const;

void GRID_SCREEN;

export default async function Page() {
  await requireMenuAccess("/payroll/gl-accounts");

  return (
    <AppShell title="계정과목관리" description="급여 전표 생성에 사용되는 GL 계정과목을 관리합니다.">
      <AgGridModulesProvider>
        <PayGlAccountManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
