import { TraApplicationsManager } from "@/components/tra/tra-applications-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.applications",
} as const;

export default async function TraApplicationsPage() {
  await requireMenuAccess("/tra/applications");
  return <TraApplicationsManager />;
}
