import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/tim/check-in");

  return (
    <AppShell title="출퇴근기록" description="Phase 2 구현 예정 화면">
      <div className="p-6 text-sm text-muted-foreground">출퇴근기록 화면은 현재 준비 중입니다. 다음 배포에서 기능을 연결합니다.</div>
    </AppShell>
  );
}
