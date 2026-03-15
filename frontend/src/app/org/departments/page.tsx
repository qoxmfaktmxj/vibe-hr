import { OrganizationManager } from "@/components/org/organization-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "org.departments",
} as const;

void GRID_SCREEN;

export default async function OrganizationDepartmentsPage() {
  await requireMenuAccess("/org/departments");

  return (
      <OrganizationManager />
  );
}
