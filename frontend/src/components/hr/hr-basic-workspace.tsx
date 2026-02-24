"use client";

import { useEffect, useMemo, useState } from "react";

import { HrBasicTabs } from "@/components/hr/hr-basic-tabs";
import { HrEmployeeHeader } from "@/components/hr/hr-employee-header";
import type { EmployeeItem } from "@/types/employee";
import type { HrBasicDetailResponse } from "@/types/hr-employee-profile";

export function HrBasicWorkspace() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [detail, setDetail] = useState<HrBasicDetailResponse | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/employees", { cache: "no-store" });
      if (!response.ok) return;
      const json = (await response.json()) as { employees?: EmployeeItem[] };
      setEmployees(json.employees ?? []);
    }
    void load();
  }, []);

  const selectedEmployee = useMemo(
    () => employees.find((item) => item.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  async function reload(targetId: number | null = selectedEmployeeId) {
    if (!targetId) {
      setDetail(null);
      return;
    }
    const response = await fetch(`/api/hr/basic/${targetId}`, { cache: "no-store" });
    if (!response.ok) {
      setDetail(null);
      return;
    }
    const json = (await response.json()) as HrBasicDetailResponse;
    setDetail(json);
  }

  useEffect(() => {
    void reload(selectedEmployeeId);
  }, [selectedEmployeeId]);

  return (
    <>
      <HrEmployeeHeader selectedEmployeeId={selectedEmployeeId} onSelectEmployee={setSelectedEmployeeId} />
      <HrBasicTabs
        employeeId={selectedEmployeeId}
        onReload={async () => reload(selectedEmployeeId)}
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
