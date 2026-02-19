export type MenuAdminItem = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  path: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  children: MenuAdminItem[];
};

export type MenuAdminTreeResponse = {
  menus: MenuAdminItem[];
};

export type RoleItem = {
  id: number;
  code: string;
  name: string;
};

export type RoleListResponse = {
  roles: RoleItem[];
};

export type RoleDetailResponse = {
  role: RoleItem;
};

export type MenuRoleMappingResponse = {
  menu_id: number;
  roles: RoleItem[];
};

export type RoleMenuMappingResponse = {
  role_id: number;
  menus: MenuAdminItem[];
};
