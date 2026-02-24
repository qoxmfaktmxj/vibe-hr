import { HrBasicWorkspace } from "@/components/hr/hr-basic-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function HrBasicPage() {
  await requireMenuAccess("/hr/basic");

  return (
    <AppShell title="인사기본" description="개인 중심 인사 마스터/이력 통합 조회">
      <HrBasicWorkspace />
    </AppShell>
  );
}
