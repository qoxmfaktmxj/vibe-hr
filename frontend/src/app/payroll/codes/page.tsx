import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayrollCodeManager } from "@/components/payroll/payroll-code-manager";

export default async function Page() {
  await requireMenuAccess("/payroll/codes");

  return (
    <AppShell title="급여코드관리" description="급여 지급의 성격과 주기를 정의하는 급여코드 관리">
      <PayrollCodeManager />
    </AppShell>
  );
}
