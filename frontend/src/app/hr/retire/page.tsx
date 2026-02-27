import { requireMenuAccess } from "@/lib/guard";
import Link from "next/link";

export default async function HrRetirePage() {
  await requireMenuAccess("/hr/retire/approvals");

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-xl font-semibold">퇴직관리</h1>
      <p className="text-sm text-muted-foreground">하위 기능을 선택해 이동하세요.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Link
          href="/hr/retire/checklist"
          className="rounded-md border p-4 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          퇴직체크리스트
        </Link>
        <Link
          href="/hr/retire/approvals"
          className="rounded-md border p-4 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          퇴직승인관리
        </Link>
      </div>
    </div>
  );
}
