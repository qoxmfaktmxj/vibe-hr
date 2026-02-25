import { AppShell } from "@/components/layout/app-shell";
import { InfraConfigManager } from "@/components/mng/infra-config-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngInfraPage() {
  await requireMenuAccess("/mng/infra");

  return (
    <AppShell title="인프라구성관리" description="인프라 마스터 및 구성 상세를 관리합니다.">
      <InfraConfigManager />
    </AppShell>
  );
}

