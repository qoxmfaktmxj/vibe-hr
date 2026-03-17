import { TraApplicationsManager } from "@/components/tra/tra-applications-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "tra.applications",
} as const;

void GRID_SCREEN;

export default async function TraApplicationsPage() {
  await requireMenuAccess("/tra/applications");
  return <TraApplicationsManager />;
}
