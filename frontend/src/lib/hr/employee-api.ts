import type {
  DepartmentItem,
  DepartmentListResponse,
  EmployeeItem,
  EmployeeListResponse,
} from "@/types/employee";

export type EmployeeBaseData = {
  employees: EmployeeItem[];
  departments: DepartmentItem[];
};

type EmployeeApiErrorMessages = {
  loadEmployeeError: string;
  loadDepartmentError: string;
};

type FetchEmployeeBaseDataOptions = {
  force?: boolean;
};

let employeeBaseDataCache: EmployeeBaseData | null = null;

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
}

export function setEmployeeBaseDataCache(data: EmployeeBaseData): void {
  employeeBaseDataCache = data;
}

export async function fetchEmployeeBaseData(
  messages: EmployeeApiErrorMessages,
  options: FetchEmployeeBaseDataOptions = {},
): Promise<EmployeeBaseData> {
  if (!options.force && employeeBaseDataCache) {
    return employeeBaseDataCache;
  }

  const [employeeResponse, departmentResponse] = await Promise.all([
    fetch("/api/employees", { cache: "no-store" }),
    fetch("/api/employees/departments", { cache: "no-store" }),
  ]);

  if (!employeeResponse.ok) {
    throw new Error(await parseErrorDetail(employeeResponse, messages.loadEmployeeError));
  }
  if (!departmentResponse.ok) {
    throw new Error(await parseErrorDetail(departmentResponse, messages.loadDepartmentError));
  }

  const employeeJson = (await employeeResponse.json()) as EmployeeListResponse;
  const departmentJson = (await departmentResponse.json()) as DepartmentListResponse;

  const baseData = {
    employees: employeeJson.employees,
    departments: departmentJson.departments,
  };

  setEmployeeBaseDataCache(baseData);
  return baseData;
}
