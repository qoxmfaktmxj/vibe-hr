import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.evaluations",
} as const;

export default async function Page() {
  await requireMenuAccess("/hr/admin/evaluations");

  return (
      <HrAdminRecordManager category="evaluation" title="평가관리" />
  );
}
