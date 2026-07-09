import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PaySeveranceItemRuleManager } from "@/components/payroll/pay-severance-item-rule-manager";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.severance-item-rules",
} as const;

void GRID_SCREEN;

export default async function Page() {
  await requireMenuAccess("/payroll/severance-item-rules");

  return (
    <AppShell title="퇴직금산입규칙관리" description="퇴직금 평균임금 산정 시 급여항목별 산입 방식을 정의합니다.">
      <AgGridModulesProvider>
        <PaySeveranceItemRuleManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
