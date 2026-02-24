import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/hr/admin/military");

  return (
    <AppShell title="병역관리" description="관리자용 AG Grid 데이터 관리 화면">
      <HrAdminRecordManager category="military" title="병역관리" />
    </AppShell>
  );
}
