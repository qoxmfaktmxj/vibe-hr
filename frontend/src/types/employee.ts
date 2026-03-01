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

export type EmployeeBatchPayload = {
  mode?: "atomic";
  request_id?: string;
  insert: Array<{
    display_name: string;
    department_id: number;
    position_title: string;
    hire_date: string | null;
    employment_status: EmployeeItem["employment_status"];
    login_id?: string | null;
    email?: string | null;
    password?: string;
  }>;
  update: Array<{
    id: number;
    display_name?: string;
    department_id?: number;
    position_title?: string;
    hire_date?: string | null;
    employment_status?: EmployeeItem["employment_status"];
    email?: string;
    is_active?: boolean;
    password?: string;
  }>;
  delete: number[];
};

export type EmployeeBatchResponse = {
  inserted_count: number;
  updated_count: number;
  deleted_count: number;
};
