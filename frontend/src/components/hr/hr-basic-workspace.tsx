"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";

import { HrBasicTabs } from "@/components/hr/hr-basic-tabs";
import { HrEmployeeHeader } from "@/components/hr/hr-employee-header";
import { fetcher } from "@/lib/fetcher";
import type { EmployeeItem, EmployeeListResponse } from "@/types/employee";
import type { HrBasicDetailResponse } from "@/types/hr-employee-profile";

export function HrBasicWorkspace() {
  const searchParams = useSearchParams();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const requestedEmployeeNo = searchParams.get("employeeNo")?.trim() ?? "";

  const { data: employeeData } = useSWR<{ employees?: EmployeeItem[] }>("/api/employees", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60_000,
  });
  const requestedEmployeeKey = requestedEmployeeNo
    ? `/api/employees?all=true&employee_no=${encodeURIComponent(requestedEmployeeNo)}`
    : null;
  const { data: requestedEmployeeData } = useSWR<EmployeeListResponse>(requestedEmployeeKey, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60_000,
  });
  const requestedEmployee = requestedEmployeeData?.employees?.[0] ?? null;
  const employees = useMemo(() => {
    const base = employeeData?.employees ?? [];
    if (!requestedEmployee) return base;
    return base.some((item) => item.id === requestedEmployee.id) ? base : [requestedEmployee, ...base];
  }, [employeeData?.employees, requestedEmployee]);

  const resolvedEmployeeId = selectedEmployeeId ?? requestedEmployee?.id ?? employees[0]?.id ?? null;

  const detailKey = resolvedEmployeeId ? `/api/hr/basic/${resolvedEmployeeId}` : null;
  const { data: detail } = useSWR<HrBasicDetailResponse>(detailKey, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 20_000,
  });

  const selectedEmployee = useMemo(
    () => employees.find((item) => item.id === resolvedEmployeeId) ?? null,
    [employees, resolvedEmployeeId],
  );

  return (
    <>
      <HrEmployeeHeader
        employees={employees}
        selectedEmployeeId={resolvedEmployeeId}
        onSelectEmployee={setSelectedEmployeeId}
      />
      <HrBasicTabs
        employeeId={resolvedEmployeeId}
        onReload={async () => {
          if (!detailKey) return;
          await mutate(detailKey);
        }}
        detail={
          detail ??
          (selectedEmployee
            ? {
                profile: {
                  employee_id: selectedEmployee.id,
                  employee_no: selectedEmployee.employee_no,
                  full_name: selectedEmployee.display_name,
                  hire_date: selectedEmployee.hire_date,
                  department_name: selectedEmployee.department_name,
                  position_title: selectedEmployee.position_title,
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
