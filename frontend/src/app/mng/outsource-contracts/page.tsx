import { AppShell } from "@/components/layout/app-shell";
import { OutsourceContractManager } from "@/components/mng/outsource-contract-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngOutsourceContractsPage() {
  await requireMenuAccess("/mng/outsource-contracts");

  return (
    <AppShell title="외주계약관리" description="외주인력 계약 정보를 관리합니다.">
      <OutsourceContractManager />
    </AppShell>
  );
}

