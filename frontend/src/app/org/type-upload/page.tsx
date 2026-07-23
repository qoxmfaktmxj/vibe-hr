import { requireMenuAccess } from "@/lib/guard";
import { OrgMappingUploadManager } from "@/components/org/org-mapping-upload-manager";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "org.type-upload",
} as const;

export default async function Page() {
  await requireMenuAccess("/org/type-upload");

  return <OrgMappingUploadManager />;
}
