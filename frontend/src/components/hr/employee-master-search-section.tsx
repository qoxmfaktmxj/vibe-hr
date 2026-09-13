"use client";
import { useState } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import type { ActiveFilter, SearchFilters } from "@/lib/hr/employee-master-helpers";
import { SEARCH_PLACEHOLDERS } from "@/lib/grid/search-presets";
import type { EmployeeItem } from "@/types/employee";

type Props = {
  filters: SearchFilters; appliedFilters: SearchFilters; holidayDateKeys: string[];
  positionFilterOptions: { value: string; label: string }[];
  statusOptions: { value: EmployeeItem["employment_status"]; label: string }[];
  onQuery: () => void; onReset: () => void; queryDisabled?: boolean;
  onEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onEmployeeNoChange: (value: string) => void; onNameChange: (value: string) => void;
  onDepartmentChange: (value: string) => void; onPositionChange: (values: string[]) => void;
  onHireDateToChange: (value: string) => void; onActiveChange: (value: ActiveFilter) => void;
  onEmploymentStatusesChange: (values: EmployeeItem["employment_status"][]) => void;
};
export function EmployeeMasterSearchSection(props: Props) {
  const { filters, appliedFilters, queryDisabled } = props;
  const [expanded, setExpanded] = useState(Boolean(filters.positions.length || filters.hireDateTo || filters.active));
  const conditions = [
    appliedFilters.employeeNo && `사번 ${appliedFilters.employeeNo}`,
    appliedFilters.name && `이름 ${appliedFilters.name}`,
    appliedFilters.department && `부서 ${appliedFilters.department}`,
    appliedFilters.positions.length > 0 && `직책 ${appliedFilters.positions.join(", ")}`,
    appliedFilters.hireDateTo && `입사일 ${appliedFilters.hireDateTo} 이전`,
    appliedFilters.active && `계정 ${appliedFilters.active === "Y" ? "활성" : "비활성"}`,
    appliedFilters.employmentStatuses.length > 0 && `재직상태 ${appliedFilters.employmentStatuses.map(value => props.statusOptions.find(option => option.value === value)?.label ?? value).join(", ")}`,
  ].filter(Boolean);
  return <ManagerSearchSection title="사원 검색" onQuery={props.onQuery} queryDisabled={queryDisabled}>
    <SearchFieldGrid className="xl:grid-cols-4">
      <SearchTextField value={filters.employeeNo} onChange={props.onEmployeeNoChange} onKeyDown={props.onEnter} placeholder={SEARCH_PLACEHOLDERS.employeeNo} />
      <SearchTextField value={filters.name} onChange={props.onNameChange} onKeyDown={props.onEnter} placeholder={SEARCH_PLACEHOLDERS.employeeName} />
      <SearchTextField value={filters.department} onChange={props.onDepartmentChange} onKeyDown={props.onEnter} placeholder={SEARCH_PLACEHOLDERS.departmentName} />
      <MultiSelectFilter options={props.statusOptions} values={filters.employmentStatuses} onChange={props.onEmploymentStatusesChange} summaryPrefix="재직상태" searchPlaceholder="재직상태 검색" />
    </SearchFieldGrid>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls="employee-advanced-search" onClick={() => setExpanded(!expanded)}><SlidersHorizontal className="h-3.5 w-3.5" />상세 검색</Button>
      <Button variant="ghost" size="sm" onClick={props.onReset} disabled={queryDisabled}><RotateCcw className="h-3.5 w-3.5" />조건 초기화</Button>
      <span className="text-xs text-muted-foreground" role="status">{conditions.length ? `적용된 조건: ${conditions.join(" / ")}` : "전체 사원 조회"}</span>
    </div>
    {expanded && <div id="employee-advanced-search" className="employee-filter-extra mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-3">
      <div className="space-y-1 text-xs text-muted-foreground"><p>직책</p><MultiSelectFilter options={props.positionFilterOptions} values={filters.positions} onChange={props.onPositionChange} summaryPrefix="직책" searchPlaceholder="직책 검색" /></div>
      <div className="space-y-1 text-xs text-muted-foreground"><p>입사일 이전</p><CustomDatePicker value={filters.hireDateTo} onChange={props.onHireDateToChange} holidays={props.holidayDateKeys} placeholder={SEARCH_PLACEHOLDERS.hireDateTo} className="w-full" /></div>
      <label className="space-y-1 text-xs text-muted-foreground">계정 사용 여부<select value={filters.active} onChange={(e) => props.onActiveChange(e.target.value as ActiveFilter)} onKeyDown={props.onEnter} aria-label="계정 사용 여부" className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"><option value="">전체</option><option value="Y">활성</option><option value="N">비활성</option></select></label>
    </div>}
  </ManagerSearchSection>;
}
