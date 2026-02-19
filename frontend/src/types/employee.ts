export type DepartmentItem = {
  id: number;
  code: string;
  name: string;
};

export type EmployeeItem = {
  id: number;
  employee_no: string;
  login_id: string;
  display_name: string;
  email: string;
  department_id: number;
  department_name: string;
  position_title: string;
  hire_date: string;
  employment_status: "active" | "leave" | "resigned";
  is_active: boolean;
};

export type EmployeeListResponse = {
  employees: EmployeeItem[];
  total_count: number;
};

export type EmployeeDetailResponse = {
  employee: EmployeeItem;
};

export type DepartmentListResponse = {
  departments: DepartmentItem[];
};
