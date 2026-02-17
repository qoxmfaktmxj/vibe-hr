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
