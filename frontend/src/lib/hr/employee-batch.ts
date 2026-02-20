import type { EmployeeBatchPayload, EmployeeItem } from "@/types/employee";
import type { GridRowStatus } from "@/lib/hr/grid-change-tracker";

export type EmployeeBatchRowLike = {
  id: number;
  employee_no: string;
  login_id: string;
  display_name: string;
  email: string;
  department_id: number;
  position_title: string;
  hire_date: string;
  employment_status: EmployeeItem["employment_status"];
  is_active: boolean;
  password: string;
  _status: GridRowStatus;
};

export function buildEmployeeBatchPayload(rows: EmployeeBatchRowLike[]): EmployeeBatchPayload {
  const toInsert = rows.filter((row) => row._status === "added");
  const toUpdate = rows.filter((row) => row._status === "updated");
  const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0).map((row) => row.id);

  return {
    mode: "atomic",
    request_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    insert: toInsert.map((row) => ({
      display_name: row.display_name.trim(),
      department_id: row.department_id,
      position_title: row.position_title.trim() || "사원",
      hire_date: row.hire_date || null,
      employment_status: row.employment_status,
      login_id: row.login_id.trim() || null,
      email: row.email.trim() || null,
      password: row.password.trim() || "admin",
    })),
    update: toUpdate.map((row) => ({
      id: row.id,
      display_name: row.display_name.trim(),
      department_id: row.department_id,
      position_title: row.position_title.trim() || "사원",
      hire_date: row.hire_date || null,
      employment_status: row.employment_status,
      email: row.email.trim(),
      is_active: row.is_active,
      password: row.password.trim() || undefined,
    })),
    delete: toDelete,
  };
}
