import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/leave-approval");

  return (
    <AppShell title="휴가승인" description="Phase 3 구현 예정 화면">
      <div className="p-6 text-sm text-muted-foreground">휴가승인 화면은 현재 준비 중입니다. 다음 배포에서 기능을 연결합니다.</div>
    </AppShell>
  );
}
