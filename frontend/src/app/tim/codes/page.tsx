import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { AttendanceCodeManager } from "@/components/tim/attendance-code-manager";

export default async function TimCodesPage() {
  await requireMenuAccess("/tim/codes");

  return (
    <AppShell title="근태코드관리" description="근태/휴가 코드 및 사용 조건 관리">
      <AttendanceCodeManager />
    </AppShell>
  );
}
