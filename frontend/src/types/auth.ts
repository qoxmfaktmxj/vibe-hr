export type AuthUser = {
  id: number;
  email: string;
  display_name: string;
  roles: string[];
  enter_cd?: string | null;
};

export type LoginCorporationItem = {
  enter_cd: string;
  company_code: string;
  corporation_name: string;
  company_logo_url?: string | null;
};

export type LoginCorporationListResponse = {
  corporations: LoginCorporationItem[];
  total_count: number;
};

export type ImpersonationCandidate = {
  id: number;
  login_id: string;
  display_name: string;
};
