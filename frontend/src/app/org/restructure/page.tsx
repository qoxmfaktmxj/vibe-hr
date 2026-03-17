import { OrgRestructureManager } from "@/components/org/org-restructure-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "org.restructure",
} as const;

export default async function OrgRestructurePage() {
  await requireMenuAccess("/org/restructure");

  return <OrgRestructureManager />;
}
