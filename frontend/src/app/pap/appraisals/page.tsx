import { PapAppraisalManager } from "@/components/pap/pap-appraisal-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "pap.appraisals",
} as const;

void GRID_SCREEN;

export default async function PapAppraisalsPage() {
  await requireMenuAccess("/pap/appraisals");

  return <PapAppraisalManager />;
}
