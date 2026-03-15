import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { HolidayManager } from "@/components/tim/holiday-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tim.holidays",
} as const;

void GRID_SCREEN;

export default async function TimHolidaysPage() {
  await requireMenuAccess("/tim/holidays");

  return (
    <AppShell title="휴일관리" description="연도별 휴일 기준 정보 관리">
      <AgGridModulesProvider>
        <HolidayManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
