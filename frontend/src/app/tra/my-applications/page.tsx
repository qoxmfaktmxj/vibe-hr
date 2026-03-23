import { TraMyApplicationsManager } from "@/components/tra/tra-my-applications-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.my-applications",
} as const;

export default async function TraMyApplicationsPage() {
  await requireMenuAccess("/tra/my-applications");
  return <TraMyApplicationsManager />;
}
