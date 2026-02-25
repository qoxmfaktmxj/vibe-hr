import { AppShell } from "@/components/layout/app-shell";
import { AttendanceCheckinManager } from "@/components/tim/attendance-checkin-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/check-in");

  return (
    <AppShell title="출퇴근기록" description="오늘 출퇴근 처리 및 확인">
      <AttendanceCheckinManager />
    </AppShell>
  );
}
