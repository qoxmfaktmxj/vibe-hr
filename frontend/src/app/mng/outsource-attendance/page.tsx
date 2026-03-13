import { AppShell } from "@/components/layout/app-shell";
import { OutsourceAttendanceManager } from "@/components/mng/outsource-attendance-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.outsource-attendance",
} as const;

export default async function MngOutsourceAttendancePage() {
  await requireMenuAccess("/mng/outsource-attendance");

  return (
    <AppShell title="외주 근태 현황" description="외주 인력의 근태 요약과 상세 이력을 관리합니다.">
      <OutsourceAttendanceManager />
    </AppShell>
  );
}
