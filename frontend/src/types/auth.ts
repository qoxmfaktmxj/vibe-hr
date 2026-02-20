export type AuthUser = {
  id: number;
  email: string;
  display_name: string;
  roles: string[];
};

export type ImpersonationCandidate = {
  id: number;
  login_id: string;
  display_name: string;
};
