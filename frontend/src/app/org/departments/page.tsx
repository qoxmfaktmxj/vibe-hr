import { AppShell } from "@/components/layout/app-shell";
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
    <AppShell
      title="조직코드관리"
      description="조직코드 및 조직 계층을 관리합니다."
    >
      <OrganizationManager />
    </AppShell>
  );
}
