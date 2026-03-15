import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.educations",
} as const;

void GRID_SCREEN;

export default async function Page() {
  await requireMenuAccess("/hr/admin/educations");

  return (
      <HrAdminRecordManager category="education" title="학력관리" />
  );
}
