import { requireMenuAccess } from "@/lib/guard";
import { OrgMappingPersonalStatusManager } from "@/components/org/org-mapping-personal-status-manager";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "org.type-personal-status",
} as const;

export default async function Page() {
  await requireMenuAccess("/org/type-personal-status");

  return <OrgMappingPersonalStatusManager />;
}
