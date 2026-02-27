import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.careers",
} as const;

export default async function Page() {
  await requireMenuAccess("/hr/admin/careers");

  return (
      <HrAdminRecordManager category="career" title="경력관리" />
  );
}
