import { HrRetireApprovalManager } from "@/components/hr/hr-retire-approval-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.retire.approvals",
} as const;

void GRID_SCREEN;

export default async function HrRetireApprovalsPage() {
  await requireMenuAccess("/hr/retire/approvals");

  return <HrRetireApprovalManager />;
}
