import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.evaluations",
} as const;

export default async function Page() {
  await requireMenuAccess("/hr/admin/evaluations");

  return (
    <AppShell title="평가관리" description="관리자용 AG Grid 데이터 관리 화면">
      <HrAdminRecordManager category="evaluation" title="평가관리" />
    </AppShell>
  );
}
