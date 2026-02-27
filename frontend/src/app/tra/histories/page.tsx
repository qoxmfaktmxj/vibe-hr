import { TraHistoriesManager } from "@/components/tra/tra-histories-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.histories",
} as const;

export default async function TraHistoriesPage() {
  await requireMenuAccess("/tra/histories");
  return <TraHistoriesManager />;
}
