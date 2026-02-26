import { AppShell } from "@/components/layout/app-shell";
import { CommonCodeManager } from "@/components/settings/common-code-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "settings.common-codes",
} as const;

export default async function SettingsCommonCodesPage() {
  await requireMenuAccess("/settings/common-codes");

  return (
    <AppShell
      title="공통코드 관리"
      description="코드 그룹과 세부코드를 상하 그리드로 관리합니다."
    >
      <CommonCodeManager />
    </AppShell>
  );
}
