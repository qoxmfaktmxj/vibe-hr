import { HrSeveranceCalcManager } from "@/components/hr/hr-severance-calc-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.severance.calcs",
} as const;

void GRID_SCREEN;

export default async function HrSeveranceCalcsPage() {
  await requireMenuAccess("/hr/severance/calcs");

  return <HrSeveranceCalcManager />;
}
