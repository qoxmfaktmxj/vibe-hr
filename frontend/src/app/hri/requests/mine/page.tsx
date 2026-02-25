import { HriRequestWorkbench } from "@/components/hri/hri-request-workbench";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function HriMyRequestsPage() {
  await requireMenuAccess("/hri/requests/mine");

  return (
    <AppShell
      title="내 신청서"
      description="신청서 작성(임시저장/제출), 회수, 재제출을 처리합니다."
    >
      <HriRequestWorkbench />
    </AppShell>
  );
}
