import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.certificates",
} as const;

export default async function Page() {
  await requireMenuAccess("/hr/admin/certificates");

  return (
      <HrAdminRecordManager category="certificate" title="자격증관리" />
  );
}
