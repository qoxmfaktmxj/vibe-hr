export type HrEmployeeSummary = {
  id: number;
  employee_no: string;
  display_name: string;
  department_name: string;
  position_title: string;
  birth_date?: string | null;
  job_family?: string | null;
  job_role?: string | null;
  grade?: string | null;
};

export type HrInfoRow = {
  id: number;
  date?: string;
  title?: string;
  type?: string;
  organization?: string;
  value?: string;
  note?: string;
};
