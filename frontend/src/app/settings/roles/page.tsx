import { RoleAdminManager } from "@/components/settings/role-admin-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsRolesPage() {
  await requireMenuAccess("/settings/roles");

  return (
      <RoleAdminManager />
  );
}
