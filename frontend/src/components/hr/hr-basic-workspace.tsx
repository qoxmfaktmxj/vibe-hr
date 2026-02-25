"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";

import { HrBasicTabs } from "@/components/hr/hr-basic-tabs";
import { HrEmployeeHeader } from "@/components/hr/hr-employee-header";
import { fetcher } from "@/lib/fetcher";
import type { EmployeeItem } from "@/types/employee";
import type { HrBasicDetailResponse } from "@/types/hr-employee-profile";

export function HrBasicWorkspace() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const { data: employeeData } = useSWR<{ employees?: EmployeeItem[] }>("/api/employees", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60_000,
  });
  const employees = useMemo(() => employeeData?.employees ?? [], [employeeData?.employees]);
  const resolvedEmployeeId = selectedEmployeeId ?? employees[0]?.id ?? null;

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
