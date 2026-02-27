import { TraRequiredTargetsManager } from "@/components/tra/tra-required-targets-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.required-targets",
} as const;

export default async function TraRequiredTargetsPage() {
  await requireMenuAccess("/tra/required-targets");
  return <TraRequiredTargetsManager />;
}
