import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MenuAdminManager } from "@/components/settings/menu-admin-manager";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsMenusPage() {
  await requireMenuAccess("/settings/menus");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-gray-800">메뉴 관리</h1>
            <p className="text-sm text-gray-500">메뉴 CRUD 및 역할 매핑 관리</p>
          </div>
          <LogoutButton />
        </header>
        <MenuAdminManager />
      </main>
    </div>
  );
}
