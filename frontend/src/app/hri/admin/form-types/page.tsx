import { HriFormTypeManager } from "@/components/hri/hri-form-type-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function HriAdminFormTypesPage() {
  await requireMenuAccess("/hri/admin/form-types");

  return (
    <AppShell
      title="신청서 코드관리"
      description="공통 신청서 유형, 상태 정책, 수신 필요 여부를 설정합니다."
    >
      <HriFormTypeManager />
    </AppShell>
  );
}
