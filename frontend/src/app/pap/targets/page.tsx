import { PapAppraisalTargetsManager } from "@/components/pap/pap-appraisal-targets-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "pap.targets",
} as const;

export default async function PapTargetsPage() {
  await requireMenuAccess("/pap/targets");
  return <PapAppraisalTargetsManager />;
}
