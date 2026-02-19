import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { OrganizationManager } from "@/components/org/organization-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function OrganizationDepartmentsPage() {
  await requireMenuAccess("/org/departments");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{"조직코드관리"}</h1>
            <p className="text-sm text-gray-500">
              {"조직코드 및 조직 계층을 관리합니다."}
            </p>
          </div>
          <LogoutButton />
        </header>
        <OrganizationManager />
      </main>
    </div>
  );
}
