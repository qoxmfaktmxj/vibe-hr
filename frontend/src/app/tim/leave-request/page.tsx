import { AppShell } from "@/components/layout/app-shell";
import { LeaveRequestManager } from "@/components/tim/leave-request-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/leave-request");

  return (
    <AppShell title="휴가신청" description="휴가 신청 및 내 신청 내역">
      <LeaveRequestManager />
    </AppShell>
  );
}
