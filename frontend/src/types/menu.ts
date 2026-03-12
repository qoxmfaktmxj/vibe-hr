export type MenuNode = {
  id: number;
  code: string;
  name: string;
  path: string | null;
  icon: string | null;
  sort_order: number;
  children: MenuNode[];
};

export type MenuTreeResponse = {
  menus: MenuNode[];
};

export type MenuActionPermissionItem = {
  action_code: string;
  allowed: boolean;
};

export type MenuActionPermissionResponse = {
  menu_code: string;
  path: string | null;
  allowed_actions: string[];
  actions: MenuActionPermissionItem[];
};
