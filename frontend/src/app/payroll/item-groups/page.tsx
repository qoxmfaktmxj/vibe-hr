import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayItemGroupManager } from "@/components/payroll/pay-item-group-manager";

export default async function Page() {
  await requireMenuAccess("/payroll/item-groups");

  return (
    <AppShell title="항목그룹관리" description="직군별, 직무별 급여 항목 매핑 등 그룹별 속성 관리">
      <PayItemGroupManager />
    </AppShell>
  );
}
