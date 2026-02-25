import { HriApprovalTemplateManager } from "@/components/hri/hri-approval-template-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function HriAdminApprovalLinesPage() {
  await requireMenuAccess("/hri/admin/approval-lines");

  return (
    <AppShell
      title="결재선관리"
      description="조직 기반 자동 결재선(팀장/부서장/대표/수신)을 템플릿으로 관리합니다."
    >
      <HriApprovalTemplateManager />
    </AppShell>
  );
}
