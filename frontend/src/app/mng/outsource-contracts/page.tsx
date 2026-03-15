import { AppShell } from "@/components/layout/app-shell";
import { OutsourceContractManager } from "@/components/mng/outsource-contract-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.outsource-contracts",
} as const;

void GRID_SCREEN;

export default async function MngOutsourceContractsPage() {
  await requireMenuAccess("/mng/outsource-contracts");

  return (
    <AppShell title="외주 계약관리" description="외주 인력 계약 정보를 관리합니다.">
      <OutsourceContractManager />
    </AppShell>
  );
}
