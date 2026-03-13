import { HriReceiveTaskBoard } from "@/components/hri/hri-receive-task-board";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hri.tasks.receives",
} as const;

export default async function HriReceiveTasksPage() {
  await requireMenuAccess("/hri/tasks/receives");

  return (
    <AppShell title="수신함" description="결재 완료 문서를 수신 완료 또는 반려 처리합니다.">
      <HriReceiveTaskBoard />
    </AppShell>
  );
}
