import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { CommonCodeManager } from "@/components/settings/common-code-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsCommonCodesPage() {
  await requireMenuAccess("/settings/common-codes");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-gray-800">공통코드 관리</h1>
            <p className="text-sm text-gray-500">코드 그룹/코드 마스터-디테일 관리</p>
          </div>
          <LogoutButton />
        </header>
        <CommonCodeManager />
      </main>
    </div>
  );
}
