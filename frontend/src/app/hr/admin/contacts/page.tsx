import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.contacts",
} as const;

export default async function Page() {
  await requireMenuAccess("/hr/admin/contacts");

  return (
      <HrAdminRecordManager category="contact" title="주소연락처관리" />
  );
}
