import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";
import { PayrollIncomeTaxBracketManager } from "@/components/payroll/payroll-income-tax-bracket-manager";

const GRID_SCREEN = {
    engine: "ag-grid",
    profile: "standard-v2",
    registryKey: "payroll.income-tax-brackets",
} as const;

void GRID_SCREEN;

export default async function PayrollIncomeTaxBracketsPage() {
    await requireMenuAccess("/payroll/income-tax-brackets");

    return (
        <AppShell title="소득세 구간 관리" description="연도별 종합소득세 누진세율 구간(간이세액표 기준) 관리">
            <AgGridModulesProvider>
                <PayrollIncomeTaxBracketManager />
            </AgGridModulesProvider>
        </AppShell>
    );
}
