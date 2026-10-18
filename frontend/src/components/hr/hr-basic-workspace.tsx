"use client";

import { useRef, useState } from "react";
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
  const leaveRef = useRef<(proceed: () => void) => void>(proceed => proceed());
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
  const { data: detail, error, isLoading } = useSWR<HrBasicDetailResponse>(detailKey, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 20_000,
  });

  return (
    <div className="business-workspace">
      <div className="business-heading"><h1>인사기본</h1><p>구성원의 기본 정보와 인사 이력을 확인하고 관리합니다.</p></div>
      <HrEmployeeHeader
        selectedEmployee={resolvedEmployee && detail ? { ...resolvedEmployee, display_name: detail.profile.full_name ?? resolvedEmployee.display_name, hire_date: detail.profile.hire_date ?? "", department_name: detail.profile.department_name ?? resolvedEmployee.department_name, position_title: detail.profile.position_title ?? resolvedEmployee.position_title } : resolvedEmployee}
        onSelectEmployee={employee => { if (employee.id !== resolvedEmployeeId) leaveRef.current(() => setSelectedEmployee(employee)); }}
      />
      {error && <p role="alert" className="my-4 text-sm text-destructive">인사 정보를 불러오지 못했습니다. <button type="button" className="underline" onClick={() => { if (detailKey) void mutate(detailKey); }}>다시 시도</button></p>}
      {isLoading && <p role="status" className="py-6 text-sm text-muted-foreground">인사 정보를 불러오는 중입니다.</p>}
      {detail && resolvedEmployeeId && <HrBasicTabs
        key={resolvedEmployeeId}
        leaveRef={leaveRef}
        employeeId={resolvedEmployeeId}
        onReload={async () => {
          if (!detailKey) return;
          await mutate(detailKey);
        }}
        detail={detail}
      />}
    </div>
  );
}
