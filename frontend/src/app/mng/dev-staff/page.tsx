import { AppShell } from "@/components/layout/app-shell";
import { DevStaffViewer } from "@/components/mng/dev-staff-viewer";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.dev-staff",
} as const;

void GRID_SCREEN;

export default async function MngDevStaffPage() {
  await requireMenuAccess("/mng/dev-staff");

  return (
    <AppShell title="개발 인력 현황" description="프로젝트별 인력과 월별 매출 현황을 조회합니다.">
      <DevStaffViewer />
    </AppShell>
  );
}
