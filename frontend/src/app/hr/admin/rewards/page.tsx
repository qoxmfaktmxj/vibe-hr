import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "hr.admin.rewards",
} as const;

export default async function Page() {
  await requireMenuAccess("/hr/admin/rewards");

  return (
    <AppShell title="상벌관리" description="관리자용 AG Grid 데이터 관리 화면">
      <HrAdminRecordManager category="reward_penalty" title="상벌관리" />
    </AppShell>
  );
}
