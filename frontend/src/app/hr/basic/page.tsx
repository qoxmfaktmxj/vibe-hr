import { HrBasicWorkspace } from "@/components/hr/hr-basic-workspace";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = { engine: "ag-grid", profile: "standard-v2", registryKey: "hr.basic" } as const;
void GRID_SCREEN;

export default async function HrBasicPage() {
  await requireMenuAccess("/hr/basic");

  return (
      <HrBasicWorkspace />
  );
}
