import { AppShell } from "@/components/layout/app-shell";
import { ManagerStatusViewer } from "@/components/mng/manager-status-viewer";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.manager-status",
} as const;

export default async function MngManagerStatusPage() {
  await requireMenuAccess("/mng/manager-status");

  return (
    <AppShell title="담당자 현황" description="담당자와 고객사 매핑 현황을 관리합니다.">
      <ManagerStatusViewer />
    </AppShell>
  );
}
