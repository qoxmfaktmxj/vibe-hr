import { AppShell } from "@/components/layout/app-shell";
import { RoleAdminManager } from "@/components/settings/role-admin-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsRolesPage() {
  await requireMenuAccess("/settings/roles");

  return (
    <AppShell title="권한 관리" description="권한(역할) CRUD 전용 화면">
      <RoleAdminManager />
    </AppShell>
  );
}
