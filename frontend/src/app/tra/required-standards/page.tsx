import { TraRequiredStandardsManager } from "@/components/tra/tra-required-standards-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.required-standards",
} as const;

void GRID_SCREEN;

export default async function TraRequiredStandardsPage() {
  await requireMenuAccess("/tra/required-standards");
  return <TraRequiredStandardsManager />;
}
