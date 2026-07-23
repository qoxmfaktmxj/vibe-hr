import { OrgMappingAssignmentManager } from "@/components/org/org-mapping-assignment-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "org.types",
} as const;

export default async function OrgTypesPage() {
  await requireMenuAccess("/org/types");

  return <OrgMappingAssignmentManager />;
}
