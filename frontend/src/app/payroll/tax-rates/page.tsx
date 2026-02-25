import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayrollTaxRateManager } from "@/components/payroll/payroll-tax-rate-manager";

export default async function PayrollTaxRatesPage() {
    await requireMenuAccess("/payroll/tax-rates");

    return (
        <AppShell title="세율및사회보험관리" description="매년 갱신되는 4대보험 요율 및 소득세 간이세액표 상하한액 관리">
            <PayrollTaxRateManager />
        </AppShell>
    );
}
