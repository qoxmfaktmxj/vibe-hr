import { HrRetireChecklistManager } from "@/components/hr/hr-retire-checklist-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.retire.checklist",
} as const;

void GRID_SCREEN;

export default async function HrRetireChecklistPage() {
  await requireMenuAccess("/hr/retire/checklist");

  return <HrRetireChecklistManager />;
}
