import { HriReceiveTaskBoard } from "@/components/hri/hri-receive-task-board";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function HriReceiveTasksPage() {
  await requireMenuAccess("/hri/tasks/receives");

  return (
    <AppShell title="수신함" description="결재 완료된 문서의 수신 처리 완료/반려를 수행합니다.">
      <HriReceiveTaskBoard />
    </AppShell>
  );
}
