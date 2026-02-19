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
            <h1 className="text-xl font-bold text-gray-800">{"\uC870\uC9C1\uAD00\uB9AC"}</h1>
            <p className="text-sm text-gray-500">
              {"\uC870\uC9C1\uCF54\uB4DC \uBC0F \uC870\uC9C1 \uACC4\uCE35\uC744 \uAD00\uB9AC\uD569\uB2C8\uB2E4."}
            </p>
          </div>
          <LogoutButton />
        </header>
        <OrganizationManager />
      </main>
    </div>
  );
}
