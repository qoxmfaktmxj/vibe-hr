import { HrRetireChecklistManager } from "@/components/hr/hr-retire-checklist-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function HrRetireChecklistPage() {
  await requireMenuAccess("/hr/retire/checklist");

  return <HrRetireChecklistManager />;
}
