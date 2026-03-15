import { HrAdminRecordManager } from "@/components/hr/hr-admin-record-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.admin.rewards",
} as const;

void GRID_SCREEN;

export default async function Page() {
  await requireMenuAccess("/hr/admin/rewards");

  return (
      <HrAdminRecordManager category="reward_punish" title="상벌관리" />
  );
}
