import { PapFinalResultManager } from "@/components/pap/pap-final-result-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "pap.final-results",
} as const;

void GRID_SCREEN;

export default async function PapFinalResultsPage() {
  await requireMenuAccess("/pap/final-results");

  return <PapFinalResultManager />;
}
