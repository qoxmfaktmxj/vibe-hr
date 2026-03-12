import type { EmployeeItem } from "@/types/employee";
import type { GridRowStatus } from "@/lib/hr/grid-change-tracker";
import type { SearchFilters } from "@/lib/hr/employee-master-helpers";

export type EmployeeGridRow = EmployeeItem & {
  password: string;
  _status: GridRowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: GridRowStatus;
};

export type PendingReloadAction =
  | { type: "page"; page: number }
  | { type: "query"; filters: SearchFilters };

export type EmployeeMasterViewState = {
  rows: EmployeeGridRow[];
  searchFilters: SearchFilters;
  appliedFilters: SearchFilters;
  page: number;
  totalCount: number;
  tempId: number;
  syncedPageKey: string | null;
};
