import { AppShell } from "@/components/layout/app-shell";
import { OutsourceAttendanceManager } from "@/components/mng/outsource-attendance-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngOutsourceAttendancePage() {
  await requireMenuAccess("/mng/outsource-attendance");

  return (
    <AppShell title="외주근태현황" description="외주인력 근태 요약/상세를 관리합니다.">
      <OutsourceAttendanceManager />
    </AppShell>
  );
}

