import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/org/type-items");

  return (
    <AppShell title="조직구분항목" description="메뉴 단계 개편에 맞춰 생성된 화면 (상세 기능은 순차 구현)">
      <div className="p-6 text-sm text-slate-600">조직구분항목 화면 준비 완료. 다음 단계에서 상세 기능을 연결합니다.</div>
    </AppShell>
  );
}
