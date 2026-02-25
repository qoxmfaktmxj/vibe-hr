import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/reports");

  return (
    <AppShell title="근태리포트" description="Phase 4 구현 예정 화면">
      <div className="p-6 text-sm text-muted-foreground">근태리포트 화면은 현재 준비 중입니다. 다음 배포에서 통계/리포트를 연결합니다.</div>
    </AppShell>
  );
}
