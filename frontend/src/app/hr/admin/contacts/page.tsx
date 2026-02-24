import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function Page() {
  await requireMenuAccess("/hr/admin/contacts");

  return (
    <AppShell title="주소연락처관리" description="관리자용 AG Grid 데이터 관리 화면">
      <HrAdminRecordManager category="contact" title="주소연락처관리" />
    </AppShell>
  );
}
