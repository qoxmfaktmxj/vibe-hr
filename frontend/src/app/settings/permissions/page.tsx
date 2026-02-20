import { AppShell } from "@/components/layout/app-shell";
import { PermissionMatrixManager } from "@/components/settings/permission-matrix-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsPermissionsPage() {
  await requireMenuAccess("/settings/permissions");

  return (
    <AppShell title="메뉴 권한 관리" description="권한별 메뉴 접근 매핑 전용 화면">
      <PermissionMatrixManager />
    </AppShell>
  );
}
