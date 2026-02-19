export type OrganizationDepartmentItem = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationDepartmentListResponse = {
  departments: OrganizationDepartmentItem[];
  total_count: number;
  reference_date: string | null;
};

export type OrganizationDepartmentDetailResponse = {
  department: OrganizationDepartmentItem;
};
