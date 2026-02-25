import { AppShell } from "@/components/layout/app-shell";
import { DevRequestManager } from "@/components/mng/dev-request-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngDevRequestsPage() {
  await requireMenuAccess("/mng/dev-requests");

  return (
    <AppShell title="추가개발관리" description="추가개발 요청을 관리하고 월별 집계를 확인합니다.">
      <DevRequestManager />
    </AppShell>
  );
}

