"use client";

import { ManagerSearchSection } from "@/components/grid/manager-layout";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import type { ActiveFilter, SearchFilters } from "@/lib/hr/employee-master-helpers";
import { SEARCH_PLACEHOLDERS } from "@/lib/grid/search-presets";
import type { EmployeeItem } from "@/types/employee";

type Option = { value: string; label: string };
type StatusOption = { value: EmployeeItem["employment_status"]; label: string };

type EmployeeMasterSearchSectionProps = {
  filters: SearchFilters;
  holidayDateKeys: string[];
  positionFilterOptions: Option[];
  statusOptions: StatusOption[];
  onQuery: () => void;
  queryDisabled?: boolean;
  onEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onEmployeeNoChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onPositionChange: (values: string[]) => void;
  onHireDateToChange: (value: string) => void;
  onActiveChange: (value: ActiveFilter) => void;
  onEmploymentStatusesChange: (values: EmployeeItem["employment_status"][]) => void;
};

export function EmployeeMasterSearchSection({
  filters,
  holidayDateKeys,
  positionFilterOptions,
  statusOptions,
  onQuery,
  queryDisabled,
  onEnter,
  onEmployeeNoChange,
  onNameChange,
  onDepartmentChange,
  onPositionChange,
  onHireDateToChange,
  onActiveChange,
  onEmploymentStatusesChange,
}: EmployeeMasterSearchSectionProps) {
  return (
    <ManagerSearchSection
      title="사원관리"
      onQuery={onQuery}
      queryLabel="조회"
      queryDisabled={queryDisabled}
    >
      <SearchFieldGrid className="xl:grid-cols-4 2xl:grid-cols-7">
        <SearchTextField
          value={filters.employeeNo}
          onChange={onEmployeeNoChange}
          onKeyDown={onEnter}
          placeholder={SEARCH_PLACEHOLDERS.employeeNo}
        />
        <SearchTextField
          value={filters.name}
          onChange={onNameChange}
          onKeyDown={onEnter}
          placeholder={SEARCH_PLACEHOLDERS.employeeName}
        />
        <SearchTextField
          value={filters.department}
          onChange={onDepartmentChange}
          onKeyDown={onEnter}
          placeholder={SEARCH_PLACEHOLDERS.departmentName}
        />
        <MultiSelectFilter
          options={positionFilterOptions}
          values={filters.positions}
          onChange={onPositionChange}
          placeholder="전체"
          searchPlaceholder={`${SEARCH_PLACEHOLDERS.position} 검색`}
        />
        <CustomDatePicker
          value={filters.hireDateTo}
          onChange={onHireDateToChange}
          holidays={holidayDateKeys}
          placeholder={SEARCH_PLACEHOLDERS.hireDateTo}
          className="w-full"
        />
        <select
          value={filters.active}
          onChange={(event) => onActiveChange(event.target.value as ActiveFilter)}
          onKeyDown={onEnter}
          aria-label={SEARCH_PLACEHOLDERS.active}
          className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
        >
          <option value="">전체</option>
          <option value="Y">Y</option>
          <option value="N">N</option>
        </select>
        <MultiSelectFilter
          options={statusOptions}
          values={filters.employmentStatuses}
          onChange={onEmploymentStatusesChange}
          placeholder="전체"
          searchPlaceholder={`${SEARCH_PLACEHOLDERS.employmentStatus} 검색`}
        />
      </SearchFieldGrid>
    </ManagerSearchSection>
  );
}
