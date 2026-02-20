import { EmployeeMasterManager } from "@/components/hr/employee-master-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function HrEmployeePage() {
  await requireMenuAccess("/hr/employee");

  return (
    <AppShell
      title="사원관리"
      description="로그인 계정과 1:1 매핑되는 인사 마스터 관리 화면"
    >
      <EmployeeMasterManager />
    </AppShell>
  );
}
