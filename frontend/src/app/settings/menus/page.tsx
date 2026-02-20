import { AppShell } from "@/components/layout/app-shell";
import { MenuAdminManager } from "@/components/settings/menu-admin-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsMenusPage() {
  await requireMenuAccess("/settings/menus");

  return (
    <AppShell title="메뉴 관리" description="메뉴 CRUD 및 역할 매핑 관리">
      <MenuAdminManager />
    </AppShell>
  );
}
