import { CorporationManager } from "@/components/org/corporation-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "org.corporations",
} as const;

export default async function OrganizationCorporationsPage() {
  await requireMenuAccess("/org/corporations");

  return <CorporationManager />;
}
