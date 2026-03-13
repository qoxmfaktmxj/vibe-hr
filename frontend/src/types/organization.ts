export type OrganizationDepartmentItem = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  organization_type: string | null;
  cost_center_code: string | null;
  description: string | null;
  employee_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationDepartmentListResponse = {
  departments: OrganizationDepartmentItem[];
  total_count: number;
  reference_date: string | null;
  page?: number | null;
  limit?: number | null;
};

export type OrganizationDepartmentDetailResponse = {
  department: OrganizationDepartmentItem;
};

export type OrganizationCorporationItem = {
  id: number;
  enter_cd: string;
  company_code: string;
  corporation_name: string;
  corporation_number: string | null;
  business_number: string | null;
  company_seal_url: string | null;
  certificate_seal_url: string | null;
  company_logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationCorporationListResponse = {
  corporations: OrganizationCorporationItem[];
  total_count: number;
  page?: number | null;
  limit?: number | null;
};

export type OrganizationCorporationDetailResponse = {
  corporation: OrganizationCorporationItem;
};
