"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";

import { HrBasicTabs } from "@/components/hr/hr-basic-tabs";
import { HrEmployeeHeader } from "@/components/hr/hr-employee-header";
import { fetcher } from "@/lib/fetcher";
import type { EmployeeItem, EmployeeListResponse } from "@/types/employee";
import type { HrBasicDetailResponse } from "@/types/hr-employee-profile";

export function HrBasicWorkspace() {
  const searchParams = useSearchParams();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);
  const requestedEmployeeNo = searchParams.get("employeeNo")?.trim() ?? "";

  const { data: employeeData } = useSWR<EmployeeListResponse>("/api/employees?page=1&limit=8", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60_000,
  });
  const requestedEmployeeKey = requestedEmployeeNo
    ? `/api/employees?page=1&limit=100&employee_no=${encodeURIComponent(requestedEmployeeNo)}`
    : null;
  const { data: requestedEmployee = null } = useSWR<EmployeeItem | null>(requestedEmployeeKey, async (url: string) => {
    const params = new URLSearchParams(url.split("?")[1]);
    for (let page = 1; ; page += 1) {
      params.set("page", String(page));
      const response = await fetcher<EmployeeListResponse>(`/api/employees?${params.toString()}`);
      const exactMatch = response.employees.find(
        (item) => item.employee_no.toLowerCase() === requestedEmployeeNo.toLowerCase(),
      );
      if (exactMatch) return exactMatch;
      if (page * 100 >= response.total_count) return null;
    }
  }, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60_000,
  });
  const resolvedEmployee = selectedEmployee ?? (requestedEmployeeNo ? requestedEmployee : employeeData?.employees[0] ?? null);
  const resolvedEmployeeId = resolvedEmployee?.id ?? null;

  const detailKey = resolvedEmployeeId ? `/api/hr/basic/${resolvedEmployeeId}` : null;
  const { data: detail } = useSWR<HrBasicDetailResponse>(detailKey, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 20_000,
  });

  return (
    <>
      <HrEmployeeHeader
        selectedEmployee={resolvedEmployee}
        onSelectEmployee={setSelectedEmployee}
      />
      <HrBasicTabs
        employeeId={resolvedEmployeeId}
        onReload={async () => {
          if (!detailKey) return;
          await mutate(detailKey);
        }}
        detail={
          detail ??
          (resolvedEmployee
            ? {
                profile: {
                  employee_id: resolvedEmployee.id,
                  employee_no: resolvedEmployee.employee_no,
                  full_name: resolvedEmployee.display_name,
                  hire_date: resolvedEmployee.hire_date,
                  department_name: resolvedEmployee.department_name,
                  position_title: resolvedEmployee.position_title,
                },
                appointments: [],
                rewards_penalties: [],
                contacts: [],
                educations: [],
                careers: [],
                certificates: [],
                military: [],
                evaluations: [],
              }
            : null)
        }
      />
    </>
  );
}
