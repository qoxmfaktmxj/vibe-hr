import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.appointments",
} as const;

export default async function Page() {
  await requireMenuAccess("/hr/admin/appointments");

  return (
      <HrAdminRecordManager category="appointment" title="발령관리" />
  );
}
