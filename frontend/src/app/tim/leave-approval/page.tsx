import { AppShell } from "@/components/layout/app-shell";
import { LeaveApprovalManager } from "@/components/tim/leave-approval-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/leave-approval");

  return (
    <AppShell title="휴가승인" description="승인 대기 휴가 처리">
      <LeaveApprovalManager />
    </AppShell>
  );
}
