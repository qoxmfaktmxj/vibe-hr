import { HriApprovalTaskBoard } from "@/components/hri/hri-approval-task-board";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hri.tasks.approvals",
} as const;

export default async function HriApprovalTasksPage() {
  await requireMenuAccess("/hri/tasks/approvals");

  return (
    <AppShell title="결재함" description="내게 할당된 결재 문서를 확인하고 승인 또는 반려합니다.">
      <HriApprovalTaskBoard />
    </AppShell>
  );
}
