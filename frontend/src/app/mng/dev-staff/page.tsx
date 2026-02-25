import { AppShell } from "@/components/layout/app-shell";
import { DevStaffViewer } from "@/components/mng/dev-staff-viewer";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngDevStaffPage() {
  await requireMenuAccess("/mng/dev-staff");

  return (
    <AppShell title="인력현황" description="프로젝트별 인력 및 월별 매출 현황을 조회합니다.">
      <DevStaffViewer />
    </AppShell>
  );
}

