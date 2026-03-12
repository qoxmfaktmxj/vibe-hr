"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import type {
  ColDef,
  ICellEditorParams,
  ICellRendererParams,
} from "ag-grid-community";

import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { getGridStatusCellClass } from "@/lib/grid/grid-status";
import type { GridRowStatus } from "@/lib/hr/grid-change-tracker";
import type { DepartmentItem, EmployeeItem } from "@/types/employee";
import type { EmployeeGridRow } from "@/components/hr/employee-master-types";

type HireDateEditorProps = ICellEditorParams<EmployeeGridRow, string> & { holidays?: string[] };

type EmployeeMasterGridLabels = {
  colDeleteMark: string;
  colStatus: string;
  colEmployeeNo: string;
  colLoginId: string;
  colName: string;
  colDepartment: string;
  colPosition: string;
  colHireDate: string;
  colEmploymentStatus: string;
  colEmail: string;
  colActive: string;
  colPassword: string;
};

type BuildEmployeeMasterColumnDefsArgs = {
  labels: EmployeeMasterGridLabels;
  lockHeader: (label: string) => string;
  statusLabels: Record<GridRowStatus, string>;
  departments: DepartmentItem[];
  departmentNameById: Map<number, string>;
  positionNames: string[];
  holidayDateKeys: string[];
  employmentStatusValues: EmployeeItem["employment_status"][];
  employmentLabelByCode: Map<string, string>;
  onToggleDelete: (rowId: number, checked: boolean) => void;
};

function normalizeDateKey(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  return text.slice(0, 10);
}

function toDisplayEmploymentStatus(
  status: EmployeeItem["employment_status"],
  labelByCode: Map<string, string>,
): string {
  return labelByCode.get(status) ?? status;
}

const HireDateCellEditor = forwardRef<
  { getValue: () => string; isPopup: () => boolean },
  HireDateEditorProps
>(function HireDateCellEditor(props, ref) {
  const [value, setValue] = useState(() => normalizeDateKey(props.value));

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => value,
      isPopup: () => true,
    }),
    [value],
  );

  const handleChange = useCallback(
    (nextValue: string) => {
      setValue(nextValue);
      props.stopEditing();
    },
    [props],
  );

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2 shadow-lg">
      <CustomDatePicker
        value={value}
        onChange={handleChange}
        holidays={props.holidays ?? []}
        inline
        closeOnSelect={false}
      />
    </div>
  );
});

export function buildEmployeeMasterColumnDefs({
  labels,
  lockHeader,
  statusLabels,
  departments,
  departmentNameById,
  positionNames,
  holidayDateKeys,
  employmentStatusValues,
  employmentLabelByCode,
  onToggleDelete,
}: BuildEmployeeMasterColumnDefsArgs): ColDef<EmployeeGridRow>[] {
  return [
    {
      headerName: lockHeader(labels.colDeleteMark),
      headerTooltip: "직접 입력 수정 불가(삭제 체크로만 변경)",
      width: 56,
      pinned: "left",
      sortable: false,
      filter: false,
      resizable: false,
      editable: false,
      cellRenderer: (params: ICellRendererParams<EmployeeGridRow>) => {
        const row = params.data;
        if (!row) return null;
        const checked = row._status === "deleted";
        return (
          <div className="flex h-full items-center justify-center">
            <input
              type="checkbox"
              checked={checked}
              className="h-4 w-4 cursor-pointer accent-[var(--vibe-accent-red)]"
              onChange={(event) => onToggleDelete(row.id, event.target.checked)}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        );
      },
    },
    {
      headerName: lockHeader(labels.colStatus),
      headerTooltip: "시스템 상태 컬럼(자동 계산)",
      field: "_status",
      width: 80,
      editable: false,
      cellClass: (params) => getGridStatusCellClass(params.value as GridRowStatus),
      valueFormatter: (params) => statusLabels[(params.value as GridRowStatus) ?? "clean"],
    },
    {
      headerName: lockHeader(labels.colEmployeeNo),
      headerTooltip: "신규 행에서만 수정 가능",
      field: "employee_no",
      width: 120,
      editable: (params) => params.data?._status === "added",
    },
    {
      headerName: lockHeader(labels.colLoginId),
      headerTooltip: "신규 행에서만 수정 가능",
      field: "login_id",
      width: 130,
      editable: (params) => params.data?._status === "added",
    },
    {
      headerName: labels.colName,
      field: "display_name",
      width: 120,
      editable: (params) => params.data?._status !== "deleted",
    },
    {
      headerName: labels.colDepartment,
      field: "department_id",
      width: 140,
      editable: (params) => params.data?._status !== "deleted",
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: departments.map((department) => department.id) },
      valueFormatter: (params) => departmentNameById.get(Number(params.value)) ?? "",
      valueParser: (params) => Number(params.newValue),
    },
    {
      headerName: labels.colPosition,
      field: "position_title",
      width: 120,
      editable: (params) => params.data?._status !== "deleted",
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: positionNames.length > 0 ? positionNames : ["사원"] },
    },
    {
      headerName: labels.colHireDate,
      field: "hire_date",
      width: 120,
      editable: (params) => params.data?._status !== "deleted",
      cellEditor: HireDateCellEditor,
      cellEditorParams: { holidays: holidayDateKeys },
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
    },
    {
      headerName: labels.colEmploymentStatus,
      field: "employment_status",
      width: 110,
      editable: (params) => params.data?._status !== "deleted",
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: employmentStatusValues },
      valueFormatter: (params) =>
        toDisplayEmploymentStatus(
          (params.value as EmployeeItem["employment_status"]) ?? "active",
          employmentLabelByCode,
        ),
    },
    {
      headerName: labels.colEmail,
      field: "email",
      width: 180,
      editable: (params) => params.data?._status !== "deleted",
    },
    {
      headerName: labels.colActive,
      field: "is_active",
      width: 80,
      editable: (params) => params.data?._status !== "deleted",
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: ["Y", "N"] },
      valueFormatter: (params) => (params.value ? "Y" : "N"),
      valueParser: (params) => params.newValue === "Y",
    },
    {
      headerName: labels.colPassword,
      field: "password",
      width: 160,
      editable: (params) => params.data?._status !== "deleted",
    },
  ];
}

export const EMPLOYEE_MASTER_DEFAULT_COL_DEF: ColDef<EmployeeGridRow> = {
  sortable: true,
  filter: true,
  resizable: true,
  editable: false,
};
