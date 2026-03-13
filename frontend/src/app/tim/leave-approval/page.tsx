import { AppShell } from "@/components/layout/app-shell";
import { LeaveApprovalManager } from "@/components/tim/leave-approval-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tim.leave-approval",
} as const;

export default async function Page() {
  await requireMenuAccess("/tim/leave-approval");

  return (
    <AppShell title="휴가 승인" description="승인 대기 휴가 요청을 처리합니다.">
      <LeaveApprovalManager />
    </AppShell>
  );
}
