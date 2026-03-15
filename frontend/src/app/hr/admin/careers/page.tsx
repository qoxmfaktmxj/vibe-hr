import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.careers",
} as const;

void GRID_SCREEN;

export default async function Page() {
  await requireMenuAccess("/hr/admin/careers");

  return (
      <HrAdminRecordManager category="careers" title="경력관리" />
  );
}
