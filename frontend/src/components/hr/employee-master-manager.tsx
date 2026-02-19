"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type RowStyle,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  DepartmentItem,
  DepartmentListResponse,
  EmployeeDetailResponse,
  EmployeeItem,
  EmployeeListResponse,
} from "@/types/employee";

let modulesRegistered = false;
if (!modulesRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  modulesRegistered = true;
}

type RowStatus = "clean" | "added" | "updated" | "deleted";

type EmployeeGridRow = EmployeeItem & {
  password: string;
  _status: RowStatus;
  _error?: string;
};

const I18N = {
  loading: "사원 데이터를 불러오는 중...",
  loadEmployeeError: "사원 목록을 불러오지 못했습니다.",
  loadDepartmentError: "부서 목록을 불러오지 못했습니다.",
  initError: "초기 로딩에 실패했습니다.",
  saveDone: "저장이 완료되었습니다.",
  saveFailed: "저장에 실패했습니다.",
  deleteFailed: "삭제에 실패했습니다.",
  nothingToSave: "저장할 변경 사항이 없습니다.",
  validationError: "입력 값을 확인하세요. 필수 입력이 비어 있습니다.",
  pasteDone: "클립보드 데이터를 새 행으로 추가했습니다.",
  addRowsDone: "새 행을 추가했습니다.",
  markDeleteDone: "선택한 행을 삭제 처리했습니다.",
  cancelDone: "변경 사항을 취소했습니다.",
  copiedHint:
    "화면을 클릭한 상태에서 Ctrl+V로 엑셀 행을 그리드에 추가할 수 있습니다.",
  summaryLabel: "변경 요약",
  statusClean: "",
  statusAdded: "입력",
  statusUpdated: "수정",
  statusDeleted: "삭제",
  noRows: "사원 데이터가 없습니다.",
  requiredName: "이름은 2자 이상 필수입니다.",
  requiredDepartment: "부서를 선택해야 합니다.",
  requiredPosition: "직책은 필수입니다.",
  savePartial: "일괄 저장은 완료되었지만 일부 행이 실패했습니다.",
  deleteConfirm: "선택한 행을 삭제 예정으로 변경할까요?",
  title: "사원 마스터",
  searchPlaceholder: "사번/이름/로그인ID/부서 검색",
  addRow: "입력",
  copy: "복사",
  templateDownload: "양식다운로드",
  upload: "업로드",
  download: "다운로드",
  saveAll: "저장",
  removeAddedRowDone: "선택한 행을 삭제 상태로 변경했습니다.",
  copyDone: "선택한 행을 입력행으로 복제했습니다.",
  templateDone: "양식을 다운로드했습니다.",
  uploadDone: "업로드 데이터를 반영했습니다.",
  downloadDone: "현재 시트 전체를 다운로드했습니다.",
  selectedCount: "선택",
  rowCount: "전체",
  pasteGuide:
    "엑셀 복사 열 순서: 이름 | 부서코드(또는 부서명) | 직책 | 입사일(YYYY-MM-DD) | 재직상태(active/leave/resigned) | 이메일 | 활성(Y/N) | 비밀번호",
  colStatus: "상태",
  colEmployeeNo: "사번",
  colLoginId: "로그인ID",
  colName: "이름",
  colDepartment: "부서",
  colPosition: "직책",
  colHireDate: "입사일",
  colEmploymentStatus: "재직상태",
  colEmail: "이메일",
  colActive: "활성",
  colPassword: "비밀번호(신규/변경)",
  colError: "에러",
};

const AG_GRID_LOCALE_KO: Record<string, string> = {
  page: "페이지",
  more: "더보기",
  to: "~",
  of: "/",
  next: "다음",
  last: "마지막",
  first: "처음",
  previous: "이전",
  loadingOoo: "로딩 중...",
  noRowsToShow: "데이터가 없습니다.",
  searchOoo: "검색...",
  blanks: "(빈값)",
  filterOoo: "필터...",
  applyFilter: "적용",
  equals: "같음",
  notEqual: "같지 않음",
  lessThan: "보다 작음",
  greaterThan: "보다 큼",
  contains: "포함",
  notContains: "미포함",
  startsWith: "시작",
  endsWith: "끝",
  andCondition: "그리고",
  orCondition: "또는",
  clearFilter: "초기화",
  resetFilter: "리셋",
  cancelFilter: "취소",
  textFilter: "텍스트 필터",
  numberFilter: "숫자 필터",
  dateFilter: "날짜 필터",
  selectAll: "전체 선택",
  selectAllSearchResults: "검색 결과 전체 선택",
  addCurrentSelectionToFilter: "현재 선택 추가",
  noMatches: "일치 항목 없음",
};

const STATUS_LABELS: Record<RowStatus, string> = {
  clean: I18N.statusClean,
  added: I18N.statusAdded,
  updated: I18N.statusUpdated,
  deleted: I18N.statusDeleted,
};

function toGridRow(employee: EmployeeItem): EmployeeGridRow {
  return {
    ...employee,
    password: "",
    _status: "clean",
  };
}

function normalizeEmploymentStatus(value: string): EmployeeItem["employment_status"] {
  const v = value.trim().toLowerCase();
  if (v === "leave" || v === "휴직") return "leave";
  if (v === "resigned" || v === "퇴사") return "resigned";
  return "active";
}

function parseBoolean(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "y" || v === "yes" || v === "true" || v === "1";
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { detail?: string } | null;
  return json?.detail ?? fallback;
}

export function EmployeeMasterManager() {
  const [rows, setRows] = useState<EmployeeGridRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const gridApiRef = useRef<GridApi<EmployeeGridRow> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const tempIdRef = useRef(-1);

  const departmentNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const department of departments) {
      map.set(department.id, department.name);
    }
    return map;
  }, [departments]);

  const departmentLookupList = useMemo(
    () =>
      departments.map((department) => ({
        ...department,
        codeLower: department.code.toLowerCase(),
        nameLower: department.name.toLowerCase(),
      })),
    [departments],
  );

  const changeSummary = useMemo(() => {
    const summary = { added: 0, updated: 0, deleted: 0 };
    for (const row of rows) {
      if (row._status === "added") summary.added += 1;
      else if (row._status === "updated") summary.updated += 1;
      else if (row._status === "deleted") summary.deleted += 1;
    }
    return summary;
  }, [rows]);

  const issueTempId = useCallback(() => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  }, []);

  const createEmptyRow = useCallback(
    (): EmployeeGridRow => {
      const departmentId = departments[0]?.id ?? 0;
      const today = new Date().toISOString().slice(0, 10);
      return {
        id: issueTempId(),
        employee_no: "",
        login_id: "",
        display_name: "",
        email: "",
        department_id: departmentId,
        department_name: departmentNameById.get(departmentId) ?? "",
        position_title: "사원",
        hire_date: today,
        employment_status: "active",
        is_active: true,
        password: "admin",
        _status: "added",
      };
    },
    [departmentNameById, departments, issueTempId],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);

    const [employeeRes, departmentRes] = await Promise.all([
      fetch("/api/employees", { cache: "no-store" }),
      fetch("/api/employees/departments", { cache: "no-store" }),
    ]);

    if (!employeeRes.ok) {
      throw new Error(await parseErrorDetail(employeeRes, I18N.loadEmployeeError));
    }
    if (!departmentRes.ok) {
      throw new Error(await parseErrorDetail(departmentRes, I18N.loadDepartmentError));
    }

    const employeeJson = (await employeeRes.json()) as EmployeeListResponse;
    const departmentJson = (await departmentRes.json()) as DepartmentListResponse;

    setDepartments(departmentJson.departments);
    setRows(employeeJson.employees.map((employee) => toGridRow(employee)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadBase();
      } catch (error) {
        setNoticeType("error");
        setNotice(error instanceof Error ? error.message : I18N.initError);
        setLoading(false);
      }
    })();
  }, [loadBase]);

  const columnDefs = useMemo<ColDef<EmployeeGridRow>[]>(() => {
    const statusOptions: EmployeeItem["employment_status"][] = ["active", "leave", "resigned"];

    return [
      {
        headerName: "",
        checkboxSelection: true,
        headerCheckboxSelection: true,
        width: 48,
        pinned: "left",
        sortable: false,
        filter: false,
        suppressMenu: true,
      },
      {
        headerName: I18N.colStatus,
        field: "_status",
        width: 86,
        editable: false,
        valueFormatter: (params) => STATUS_LABELS[(params.value as RowStatus) ?? "clean"],
      },
      { headerName: I18N.colEmployeeNo, field: "employee_no", width: 130, editable: false },
      {
        headerName: I18N.colLoginId,
        field: "login_id",
        width: 140,
        editable: (params) => params.data?._status === "added",
      },
      {
        headerName: I18N.colName,
        field: "display_name",
        width: 130,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colDepartment,
        field: "department_id",
        width: 150,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: departments.map((department) => department.id),
        },
        valueFormatter: (params) => {
          const value = Number(params.value);
          return departmentNameById.get(value) ?? "";
        },
        valueParser: (params) => Number(params.newValue),
      },
      {
        headerName: I18N.colPosition,
        field: "position_title",
        width: 140,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colHireDate,
        field: "hire_date",
        width: 128,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colEmploymentStatus,
        field: "employment_status",
        width: 120,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: statusOptions },
      },
      {
        headerName: I18N.colEmail,
        field: "email",
        width: 190,
        editable: (params) => params.data?._status !== "deleted",
      },
      {
        headerName: I18N.colActive,
        field: "is_active",
        width: 90,
        editable: (params) => params.data?._status !== "deleted",
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Y", "N"] },
        valueFormatter: (params) => (params.value ? "Y" : "N"),
        valueParser: (params) => params.newValue === "Y",
      },
      {
        headerName: I18N.colPassword,
        field: "password",
        width: 180,
        editable: (params) => params.data?._status !== "deleted",
      },
      { headerName: I18N.colError, field: "_error", width: 240, editable: false },
    ];
  }, [departmentNameById, departments]);

  const defaultColDef = useMemo<ColDef<EmployeeGridRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      editable: false,
    }),
    [],
  );

  const getRowStyle = useCallback((row: { data: EmployeeGridRow | undefined }): RowStyle | undefined => {
    if (!row.data) return undefined;
    if (row.data._status === "added") return { backgroundColor: "#edfdf1" };
    if (row.data._status === "updated") return { backgroundColor: "#fff8e1" };
    if (row.data._status === "deleted") {
      return {
        backgroundColor: "#ffecec",
        textDecoration: "line-through",
        color: "#b91c1c",
      };
    }
    return undefined;
  }, []);

  const onGridReady = useCallback((event: GridReadyEvent<EmployeeGridRow>) => {
    gridApiRef.current = event.api;
  }, []);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<EmployeeGridRow>) => {
      const rowId = event.data?.id;
      const field = event.colDef.field as keyof EmployeeGridRow | undefined;
      if (!rowId || !field) return;

      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;

          const next: EmployeeGridRow = { ...row, _error: undefined };

          if (field === "department_id") {
            const departmentId = Number(event.newValue);
            next.department_id = Number.isFinite(departmentId) ? departmentId : row.department_id;
            next.department_name = departmentNameById.get(next.department_id) ?? "";
          } else if (field === "employment_status") {
            next.employment_status = normalizeEmploymentStatus(String(event.newValue ?? "active"));
          } else if (field === "is_active") {
            if (typeof event.newValue === "boolean") next.is_active = event.newValue;
            else next.is_active = parseBoolean(String(event.newValue ?? "N"));
          } else if (field === "hire_date") {
            next.hire_date = String(event.newValue ?? "").slice(0, 10);
          } else if (field === "password") {
            next.password = String(event.newValue ?? "");
          } else if (field === "login_id") {
            next.login_id = String(event.newValue ?? "").trim();
          } else if (field === "display_name") {
            next.display_name = String(event.newValue ?? "");
          } else if (field === "email") {
            next.email = String(event.newValue ?? "");
          } else if (field === "position_title") {
            next.position_title = String(event.newValue ?? "");
          }

          if (next._status === "clean") next._status = "updated";
          return next;
        }),
      );
    },
    [departmentNameById],
  );

  function addRows(count: number) {
    const added = Array.from({ length: count }, () => createEmptyRow());
    setRows((prev) => [...added, ...prev]);
    setNoticeType("success");
    setNotice(I18N.addRowsDone);
  }

  const parseDepartmentId = useCallback(
    (input: string): number => {
      const value = input.trim().toLowerCase();
      if (!value) return departments[0]?.id ?? 0;

      const matched = departmentLookupList.find(
        (department) => department.codeLower === value || department.nameLower === value,
      );
      if (matched) return matched.id;

      return departments[0]?.id ?? 0;
    },
    [departmentLookupList, departments],
  );

  const handlePasteCapture = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!containerRef.current?.contains(document.activeElement)) return;

      const text = event.clipboardData.getData("text/plain");
      if (!text || !text.includes("\t")) return;

      event.preventDefault();

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) return;

      const parsedRows: EmployeeGridRow[] = [];
      for (const line of lines) {
        const cells = line.split("\t").map((cell) => cell.trim());
        const departmentId = parseDepartmentId(cells[1] ?? "");

        parsedRows.push({
          id: issueTempId(),
          employee_no: "",
          login_id: "",
          display_name: cells[0] ?? "",
          department_id: departmentId,
          department_name: departmentNameById.get(departmentId) ?? "",
          position_title: cells[2] || "사원",
          hire_date: (cells[3] || new Date().toISOString().slice(0, 10)).slice(0, 10),
          employment_status: normalizeEmploymentStatus(cells[4] || "active"),
          email: cells[5] || "",
          is_active: parseBoolean(cells[6] || "Y"),
          password: cells[7] || "admin",
          _status: "added",
        });
      }

      setRows((prev) => [...parsedRows, ...prev]);
      setNoticeType("success");
      setNotice(I18N.pasteDone);
    },
    [departmentNameById, issueTempId, parseDepartmentId],
  );

  function handleSelectionChanged() {
    if (!gridApiRef.current) return;
    const selected = gridApiRef.current.getSelectedRows();
    if (selected.length === 0) return;

    const selectedIds = new Set(selected.map((row) => row.id));
    setRows((prev) =>
      prev.map((row) => {
        if (!selectedIds.has(row.id)) return row;
        if (row._status === "deleted") return row;
        return { ...row, _status: "deleted", _error: undefined };
      }),
    );

    gridApiRef.current.deselectAll();
    setNoticeType("success");
    setNotice(I18N.removeAddedRowDone);
  }

  function copySelectedRows() {
    if (!gridApiRef.current) return;
    const selected = gridApiRef.current.getSelectedRows().filter((row) => row._status !== "deleted");
    if (selected.length === 0) return;

    const selectedIdSet = new Set(selected.map((row) => row.id));
    const clonesById = new Map<number, EmployeeGridRow>(
      selected.map((row) => [
        row.id,
        {
          ...row,
          id: issueTempId(),
          employee_no: "",
          login_id: "",
          _status: "added",
          _error: undefined,
        },
      ]),
    );

    setRows((prev) => {
      const next: EmployeeGridRow[] = [];
      for (const row of prev) {
        next.push(row);
        if (selectedIdSet.has(row.id)) {
          const clone = clonesById.get(row.id);
          if (clone) next.push(clone);
        }
      }
      return next;
    });

    setNoticeType("success");
    setNotice(I18N.copyDone);
  }

  function downloadTemplateCsv() {
    const headers = ["이름", "부서코드(또는 부서명)", "직책", "입사일", "재직상태", "이메일", "활성(Y/N)", "비밀번호"];
    const sample = ["홍길동", "HQ-HR", "사원", "2026-01-01", "active", "hong@vibe-hr.local", "Y", "admin"];
    const csv = [headers, sample]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-upload-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    setNoticeType("success");
    setNotice(I18N.templateDone);
  }

  function downloadCurrentSheetCsv() {
    const headers = ["사번", "로그인ID", "이름", "부서", "직책", "입사일", "재직상태", "이메일", "활성"];
    const data = rows
      .filter((row) => row._status !== "deleted")
      .map((row) => [
        row.employee_no,
        row.login_id,
        row.display_name,
        row.department_name || departmentNameById.get(row.department_id) || "",
        row.position_title,
        row.hire_date,
        row.employment_status,
        row.email,
        row.is_active ? "Y" : "N",
      ]);

    const csv = [headers, ...data]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employee-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNoticeType("success");
    setNotice(I18N.downloadDone);
  }

  async function handleUploadFile(file: File) {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length <= 1) return;

    const body = lines.slice(1);
    const parsedRows: EmployeeGridRow[] = [];
    for (const line of body) {
      const cells = (line.includes("	") ? line.split("	") : line.split(",")).map((cell) => cell.replace(/^"|"$/g, "").trim());
      const departmentId = parseDepartmentId(cells[1] ?? "");
      parsedRows.push({
        id: issueTempId(),
        employee_no: "",
        login_id: "",
        display_name: cells[0] ?? "",
        department_id: departmentId,
        department_name: departmentNameById.get(departmentId) ?? "",
        position_title: cells[2] || "사원",
        hire_date: (cells[3] || new Date().toISOString().slice(0, 10)).slice(0, 10),
        employment_status: normalizeEmploymentStatus(cells[4] || "active"),
        email: cells[5] || "",
        is_active: parseBoolean(cells[6] || "Y"),
        password: cells[7] || "admin",
        _status: "added",
      });
    }

    setRows((prev) => [...parsedRows, ...prev]);
    setNoticeType("success");
    setNotice(I18N.uploadDone);
  }

  function validateRow(row: EmployeeGridRow): string | null {
    if (!row.display_name.trim() || row.display_name.trim().length < 2) return I18N.requiredName;
    if (!row.department_id || !departmentNameById.has(row.department_id)) return I18N.requiredDepartment;
    if (!row.position_title.trim()) return I18N.requiredPosition;
    return null;
  }

  async function saveAllChanges() {
    const toInsert = rows.filter((row) => row._status === "added");
    const toUpdate = rows.filter((row) => row._status === "updated");
    const toDelete = rows.filter((row) => row._status === "deleted" && row.id > 0);

    if (toInsert.length + toUpdate.length + toDelete.length === 0) {
      setNoticeType("success");
      setNotice(I18N.nothingToSave);
      return;
    }

    const validationErrors = new Map<number, string>();
    for (const row of [...toInsert, ...toUpdate]) {
      const message = validateRow(row);
      if (message) validationErrors.set(row.id, message);
    }

    if (validationErrors.size > 0) {
      setRows((prev) => prev.map((row) => ({ ...row, _error: validationErrors.get(row.id) })));
      setNoticeType("error");
      setNotice(I18N.validationError);
      return;
    }

    setSaving(true);
    setNotice(null);

    const nextRows = [...rows];
    const failedMessages: string[] = [];

    const deleteResults = await Promise.all(
      toDelete.map(async (row) => {
        const response = await fetch(`/api/employees/${row.id}`, { method: "DELETE" });
        if (!response.ok) {
          const detail = await parseErrorDetail(response, I18N.deleteFailed);
          return { id: row.id, ok: false as const, message: detail };
        }
        return { id: row.id, ok: true as const };
      }),
    );

    const insertResults = await Promise.all(
      toInsert.map(async (row) => {
        const payload = {
          display_name: row.display_name.trim(),
          department_id: row.department_id,
          position_title: row.position_title.trim() || "사원",
          hire_date: row.hire_date || null,
          employment_status: row.employment_status,
          email: row.email.trim() || null,
          login_id: row.login_id.trim() || null,
          password: row.password.trim() || "admin",
        };

        const response = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = (await response.json().catch(() => null)) as
          | EmployeeDetailResponse
          | { detail?: string }
          | null;

        if (!response.ok) {
          return {
            id: row.id,
            ok: false as const,
            message: (json as { detail?: string } | null)?.detail ?? I18N.saveFailed,
          };
        }

        return { id: row.id, ok: true as const, employee: (json as EmployeeDetailResponse).employee };
      }),
    );

    const updateResults = await Promise.all(
      toUpdate.map(async (row) => {
        const payload = {
          display_name: row.display_name.trim(),
          department_id: row.department_id,
          position_title: row.position_title.trim() || "사원",
          hire_date: row.hire_date || null,
          employment_status: row.employment_status,
          email: row.email.trim(),
          is_active: row.is_active,
          password: row.password.trim() ? row.password.trim() : undefined,
        };

        const response = await fetch(`/api/employees/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = (await response.json().catch(() => null)) as
          | EmployeeDetailResponse
          | { detail?: string }
          | null;

        if (!response.ok) {
          return {
            id: row.id,
            ok: false as const,
            message: (json as { detail?: string } | null)?.detail ?? I18N.saveFailed,
          };
        }

        return { id: row.id, ok: true as const, employee: (json as EmployeeDetailResponse).employee };
      }),
    );

    const deleteSuccess = new Set(deleteResults.filter((result) => result.ok).map((result) => result.id));
    const insertSuccess = new Map(
      insertResults
        .filter((result): result is { id: number; ok: true; employee: EmployeeItem } => result.ok)
        .map((result) => [result.id, result.employee]),
    );
    const updateSuccess = new Map(
      updateResults
        .filter((result): result is { id: number; ok: true; employee: EmployeeItem } => result.ok)
        .map((result) => [result.id, result.employee]),
    );

    const errorById = new Map<number, string>();
    for (const result of [...deleteResults, ...insertResults, ...updateResults]) {
      if (!result.ok) {
        errorById.set(result.id, result.message);
        failedMessages.push(`ID ${result.id}: ${result.message}`);
      }
    }

    const mergedRows = nextRows
      .filter((row) => !deleteSuccess.has(row.id))
      .map((row) => {
        const created = insertSuccess.get(row.id);
        if (created) {
          return { ...toGridRow(created), _error: undefined };
        }

        const updated = updateSuccess.get(row.id);
        if (updated) {
          return { ...toGridRow(updated), _error: undefined };
        }

        if (errorById.has(row.id)) {
          return { ...row, _error: errorById.get(row.id) };
        }

        if (row._status === "deleted" && row.id < 0) {
          return null;
        }

        return row;
      });

    setRows(mergedRows.filter((row): row is EmployeeGridRow => row !== null));
    setSaving(false);

    if (failedMessages.length > 0) {
      setNoticeType("error");
      setNotice(`${I18N.savePartial} (${failedMessages.length}건)`);
      return;
    }

    setNoticeType("success");
    setNotice(I18N.saveDone);
  }

  if (loading) return <div className="p-6">{I18N.loading}</div>;

  return (
    <div className="space-y-4 p-6" ref={containerRef} onPasteCapture={handlePasteCapture}>
      {notice ? (
        <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {I18N.title} ({rows.length.toLocaleString()}명)
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">{I18N.pasteGuide}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => addRows(1)}>
              {I18N.addRow}
            </Button>
            <Button size="sm" variant="outline" onClick={copySelectedRows}>
              {I18N.copy}
            </Button>
            <Button size="sm" variant="outline" onClick={downloadTemplateCsv}>
              {I18N.templateDownload}
            </Button>
            <Button size="sm" variant="outline" onClick={() => uploadInputRef.current?.click()}>
              {I18N.upload}
            </Button>
            <Button size="sm" variant="outline" onClick={downloadCurrentSheetCsv}>
              {I18N.download}
            </Button>
            <Button size="sm" onClick={saveAllChanges} disabled={saving}>
              {saving ? `${I18N.saveAll}...` : I18N.saveAll}
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUploadFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">검색</Label>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={I18N.searchPlaceholder}
              />
            </div>
            <div className="flex items-end text-xs text-slate-500">
              <div>
                {I18N.summaryLabel}: {I18N.statusAdded} {changeSummary.added}건 / {I18N.statusUpdated} {changeSummary.updated}건 / {I18N.statusDeleted} {changeSummary.deleted}건
              </div>
            </div>
          </div>

          <div className="ag-theme-quartz h-[68vh] w-full rounded-md border">
            <AgGridReact<EmployeeGridRow>
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              quickFilterText={keyword}
              rowSelection="multiple"
              suppressRowClickSelection={true}
              animateRows={true}
              getRowStyle={getRowStyle}
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGridReady}
              onCellValueChanged={onCellValueChanged}
              onSelectionChanged={handleSelectionChanged}
              localeText={AG_GRID_LOCALE_KO}
              overlayNoRowsTemplate={`<span>${I18N.noRows}</span>`}
            />
          </div>

          <p className="text-xs text-slate-500">{I18N.copiedHint}</p>
        </CardContent>
      </Card>
    </div>
  );
}
