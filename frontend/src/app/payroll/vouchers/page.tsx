import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayVoucherManager } from "@/components/payroll/pay-voucher-manager";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.vouchers",
} as const;

void GRID_SCREEN;

export default async function Page() {
  await requireMenuAccess("/payroll/vouchers");

  return (
    <AppShell title="급여전표관리" description="급여 Run으로부터 GL 전표를 생성하고 확정/취소합니다.">
      <PayVoucherManager />
    </AppShell>
  );
}
