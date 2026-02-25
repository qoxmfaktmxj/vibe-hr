import { AppShell } from "@/components/layout/app-shell";
import { AttendanceStatusManager } from "@/components/tim/attendance-status-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/status");

  return (
    <AppShell title="근태현황" description="기간/상태별 근태 조회">
      <AttendanceStatusManager />
    </AppShell>
  );
}
