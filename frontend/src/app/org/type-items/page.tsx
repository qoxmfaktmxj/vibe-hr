import { requireMenuAccess } from "@/lib/guard";
import { OrgMappingTypeItemManager } from "@/components/org/org-mapping-type-item-manager";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "org.type-items",
} as const;

export default async function Page() {
  await requireMenuAccess("/org/type-items");

  return <OrgMappingTypeItemManager />;
}
