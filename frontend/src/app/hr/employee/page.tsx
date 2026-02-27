import { EmployeeMasterManager } from "@/components/hr/employee-master-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.employee",
} as const;

export default async function HrEmployeePage() {
  await requireMenuAccess("/hr/employee");

  return (
      <EmployeeMasterManager />
  );
}
