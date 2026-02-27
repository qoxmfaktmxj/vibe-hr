import { MenuAdminManager } from "@/components/settings/menu-admin-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsMenusPage() {
  await requireMenuAccess("/settings/menus");

  return (
      <MenuAdminManager />
  );
}
