import { HriApprovalTaskBoard } from "@/components/hri/hri-approval-task-board";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function HriApprovalTasksPage() {
  await requireMenuAccess("/hri/tasks/approvals");

  return (
    <AppShell title="결재함" description="나에게 할당된 결재 대기 문서를 승인/반려합니다.">
      <HriApprovalTaskBoard />
    </AppShell>
  );
}
