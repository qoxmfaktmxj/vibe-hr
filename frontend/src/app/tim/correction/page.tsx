import { AppShell } from "@/components/layout/app-shell";
import { AttendanceCorrectionManager } from "@/components/tim/attendance-correction-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/correction");

  return (
    <AppShell title="근태수정" description="근태 상태 정정 및 이력 조회">
      <AttendanceCorrectionManager />
    </AppShell>
  );
}
