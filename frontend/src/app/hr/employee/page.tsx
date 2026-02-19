import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { EmployeeMasterManager } from "@/components/hr/employee-master-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function HrEmployeePage() {
  await requireMenuAccess("/hr/employee");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Employee Master</h1>
            <p className="text-sm text-gray-500">
              Manage all employee records linked 1:1 with login accounts
            </p>
          </div>
          <LogoutButton />
        </header>
        <EmployeeMasterManager />
      </main>
    </div>
  );
}
