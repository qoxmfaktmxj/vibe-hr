"use client";

import { useEffect, useMemo, useState } from "react";

import { HrBasicTabs } from "@/components/hr/hr-basic-tabs";
import { HrEmployeeHeader } from "@/components/hr/hr-employee-header";
import type { EmployeeItem } from "@/types/employee";

export function HrBasicWorkspace() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

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

  return (
    <>
      <HrEmployeeHeader selectedEmployeeId={selectedEmployeeId} onSelectEmployee={setSelectedEmployeeId} />
      <HrBasicTabs selectedEmployee={selectedEmployee} />
    </>
  );
}
