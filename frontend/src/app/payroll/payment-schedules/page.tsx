import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { PayPaymentScheduleManager } from "@/components/payroll/pay-payment-schedule-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "payroll.payment-schedules",
} as const;

export default async function PayrollPaymentSchedulesPage() {
  await requireMenuAccess("/payroll/payment-schedules");

  return (
    <AppShell title="월급여일자관리" description="지급일 유형/지급일/휴일보정 규칙 전용 관리">
      <AgGridModulesProvider>
        <PayPaymentScheduleManager />
      </AgGridModulesProvider>
    </AppShell>
  );
}
