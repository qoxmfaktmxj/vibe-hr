import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/settings/users");

  return (
      <div className="p-6 text-sm text-slate-600">사용자관리 화면 준비 완료. 다음 단계에서 상세 기능을 연결합니다.</div>
  );
}
