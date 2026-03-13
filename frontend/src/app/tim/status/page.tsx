import { AppShell } from "@/components/layout/app-shell";
import { AttendanceStatusManager } from "@/components/tim/attendance-status-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tim.attendance-status",
} as const;

export default async function Page() {
  await requireMenuAccess("/tim/status");

  return (
    <AppShell title="근태 현황" description="기간과 상태별 출결 현황을 조회합니다.">
      <AttendanceStatusManager />
    </AppShell>
  );
}
