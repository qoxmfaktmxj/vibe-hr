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

  useEffect(() => {
    async function loadDetail() {
      if (!selectedEmployeeId) {
        setDetail(null);
        return;
      }
      const response = await fetch(`/api/hr/basic/${selectedEmployeeId}`, { cache: "no-store" });
      if (!response.ok) {
        setDetail(null);
        return;
      }
      const json = (await response.json()) as HrBasicDetailResponse;
      setDetail(json);
    }
    void loadDetail();
  }, [selectedEmployeeId]);

  return (
    <>
      <HrEmployeeHeader selectedEmployeeId={selectedEmployeeId} onSelectEmployee={setSelectedEmployeeId} />
      <HrBasicTabs detail={detail ?? (selectedEmployee ? { profile: { employee_id: selectedEmployee.id, employee_no: selectedEmployee.employee_no, full_name: selectedEmployee.display_name, hire_date: selectedEmployee.hire_date, department_name: selectedEmployee.department_name, position_title: selectedEmployee.position_title }, appointments: [], rewards_penalties: [], contacts: [], educations: [], careers: [], certificates: [], military: [], evaluations: [] } : null)} />
    </>
  );
}
