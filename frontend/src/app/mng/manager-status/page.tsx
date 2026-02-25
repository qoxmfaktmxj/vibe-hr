import { AppShell } from "@/components/layout/app-shell";
import { ManagerStatusViewer } from "@/components/mng/manager-status-viewer";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngManagerStatusPage() {
  await requireMenuAccess("/mng/manager-status");

  return (
    <AppShell title="담당자현황" description="담당자-고객사 매핑 현황을 관리합니다.">
      <ManagerStatusViewer />
    </AppShell>
  );
}

