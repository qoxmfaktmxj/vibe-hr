export type CodeGroupItem = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CodeItem = {
  id: number;
  group_id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  extra_value1: string | null;
  extra_value2: string | null;
  created_at: string;
  updated_at: string;
};

export type CodeGroupListResponse = { groups: CodeGroupItem[] };
export type CodeGroupDetailResponse = { group: CodeGroupItem };
export type CodeListResponse = { codes: CodeItem[] };
export type CodeDetailResponse = { code: CodeItem };
export type ActiveCodeOption = { code: string; name: string };
export type ActiveCodeListResponse = { group_code: string; options: ActiveCodeOption[] };
