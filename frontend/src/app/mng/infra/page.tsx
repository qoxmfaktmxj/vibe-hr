import { AppShell } from "@/components/layout/app-shell";
import { InfraConfigManager } from "@/components/mng/infra-config-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.infra",
} as const;

export default async function MngInfraPage() {
  await requireMenuAccess("/mng/infra");

  return (
    <AppShell title="인프라 구성관리" description="인프라 마스터와 구성 상세를 관리합니다.">
      <InfraConfigManager />
    </AppShell>
  );
}
