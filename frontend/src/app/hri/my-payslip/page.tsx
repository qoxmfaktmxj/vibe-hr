import { AppShell } from "@/components/layout/app-shell";
import { MyPayslipViewer } from "@/components/hri/my-payslip-viewer";
import { requireMenuAccess } from "@/lib/guard";

export default async function MyPayslipPage() {
  await requireMenuAccess("/hri/my-payslip");

  return (
    <AppShell title="내 급여조회" description="본인 급여 이력 및 상세 내역을 확인합니다.">
      <MyPayslipViewer />
    </AppShell>
  );
}
