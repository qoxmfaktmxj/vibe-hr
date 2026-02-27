import { OrganizationManager } from "@/components/org/organization-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "org.departments",
} as const;

export default async function OrganizationDepartmentsPage() {
  await requireMenuAccess("/org/departments");

  return (
      <OrganizationManager />
  );
}
