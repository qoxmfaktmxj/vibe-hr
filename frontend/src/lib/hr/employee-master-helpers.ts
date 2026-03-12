import type { EmployeeItem } from "@/types/employee";

export type ActiveFilter = "" | "Y" | "N";

export type SearchFilters = {
  employeeNo: string;
  name: string;
  department: string;
  positions: string[];
  hireDateTo: string;
  employmentStatuses: EmployeeItem["employment_status"][];
  active: ActiveFilter;
};

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  employeeNo: "",
  name: "",
  department: "",
  positions: [],
  hireDateTo: "",
  employmentStatuses: [],
  active: "",
};

export function normalizeEmploymentStatus(value: string): EmployeeItem["employment_status"] {
  const v = value.trim().toLowerCase();
  if (v === "leave" || v === "휴직") return "leave";
  if (v === "resigned" || v === "퇴직") return "resigned";
  return "active";
}

export function parseBoolean(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "y" || v === "yes" || v === "true" || v === "1";
}

export function buildEmployeeQuery(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.employeeNo.trim()) params.set("employee_no", filters.employeeNo.trim());
  if (filters.name.trim()) params.set("name", filters.name.trim());
  if (filters.department.trim()) params.set("department", filters.department.trim());
  if (filters.employmentStatuses.length === 1) params.set("employment_status", filters.employmentStatuses[0]);
  if (filters.active === "Y") params.set("active", "true");
  if (filters.active === "N") params.set("active", "false");
  return params;
}

export function cloneFilters(filters: SearchFilters): SearchFilters {
  return {
    ...filters,
    positions: [...filters.positions],
    employmentStatuses: [...filters.employmentStatuses],
  };
}

export function toDisplayEmploymentStatus(
  status: EmployeeItem["employment_status"],
  labelByCode: Map<string, string>,
): string {
  return labelByCode.get(status) ?? status;
}

export function stringifyErrorDetail(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => stringifyErrorDetail(item))
      .filter((item): item is string => Boolean(item))
      .join(" / ");
    return joined || null;
  }
  if (value && typeof value === "object") {
    const detail = Reflect.get(value, "detail");
    if (detail !== undefined) {
      return stringifyErrorDetail(detail);
    }
    const message = Reflect.get(value, "message");
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

export async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    return stringifyErrorDetail(payload) ?? fallback;
  } catch {
    return fallback;
  }
}
