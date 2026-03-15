import { TraHistoriesManager } from "@/components/tra/tra-histories-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.histories",
} as const;

void GRID_SCREEN;

export default async function TraHistoriesPage() {
  await requireMenuAccess("/tra/histories");
  return <TraHistoriesManager />;
}
