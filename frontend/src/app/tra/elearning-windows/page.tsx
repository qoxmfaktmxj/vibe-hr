import { TraElearningWindowsManager } from "@/components/tra/tra-elearning-windows-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.elearning-windows",
} as const;

export default async function TraElearningWindowsPage() {
  await requireMenuAccess("/tra/elearning-windows");
  return <TraElearningWindowsManager />;
}
