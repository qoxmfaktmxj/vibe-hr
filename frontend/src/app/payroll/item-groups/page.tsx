import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayItemGroupManager } from "@/components/payroll/pay-item-group-manager";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "payroll.item-groups",
} as const;

export default async function Page() {
  await requireMenuAccess("/payroll/item-groups");

  return (
    <AppShell title="항목그룹관리" description="직군별, 직무별 급여 항목 매핑 등 그룹별 속성 관리">
      <AgGridModulesProvider>
        <PayItemGroupManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
