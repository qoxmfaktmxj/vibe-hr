import { HrRetireApprovalManager } from "@/components/hr/hr-retire-approval-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function HrRetireApprovalsPage() {
  await requireMenuAccess("/hr/retire/approvals");

  return <HrRetireApprovalManager />;
}
