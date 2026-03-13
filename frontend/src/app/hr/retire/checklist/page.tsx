import { HrRetireChecklistManager } from "@/components/hr/hr-retire-checklist-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.retire.checklist",
} as const;

export default async function HrRetireChecklistPage() {
  await requireMenuAccess("/hr/retire/checklist");

  return <HrRetireChecklistManager />;
}
