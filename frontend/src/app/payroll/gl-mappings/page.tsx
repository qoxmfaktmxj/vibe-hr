import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayGlMappingManager } from "@/components/payroll/pay-gl-mapping-manager";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.gl-mappings",
} as const;

void GRID_SCREEN;

export default async function Page() {
  await requireMenuAccess("/payroll/gl-mappings");

  return (
    <AppShell title="급여계정매핑관리" description="급여항목을 GL 계정과목에 매핑하여 전표 생성 규칙을 정의합니다.">
      <AgGridModulesProvider>
        <PayGlMappingManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
