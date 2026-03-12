"use client";

import { useCallback, useMemo } from "react";
import { Copy, Download, FileDown, Plus, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import type { GridApi } from "ag-grid-community";

import { buildEmployeeBatchPayload } from "@/lib/hr/employee-batch";
import { clearSavedStatuses } from "@/lib/grid/grid-status-mutations";
import { parseErrorDetail, toDisplayEmploymentStatus } from "@/lib/hr/employee-master-helpers";
import type { EmployeeGridRow } from "@/components/hr/employee-master-types";
import type { EmployeeBatchResponse, EmployeeItem } from "@/types/employee";

type UseEmployeeMasterActionsArgs = {
  rows: EmployeeGridRow[];
  appliedQuery: URLSearchParams;
  saving: boolean;
  departmentsReady: boolean;
  gridApiRef: React.MutableRefObject<GridApi<EmployeeGridRow> | null>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  uploadInputRef: React.MutableRefObject<HTMLInputElement | null>;
  departmentNameById: Map<number, string>;
  positionNames: string[];
  employmentLabelByCode: Map<string, string>;
  issueTempId: () => number;
  createEmptyRow: () => EmployeeGridRow;
  parseDepartmentId: (input: string) => number;
  commitRows: (updater: (prevRows: EmployeeGridRow[]) => EmployeeGridRow[]) => void;
  mutateEmployeePage: () => Promise<unknown>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncedPageKey: React.Dispatch<React.SetStateAction<string | null>>;
  snapshotOriginal: (row: EmployeeItem) => Record<string, unknown>;
  validateRow: (row: EmployeeGridRow) => string | null;
  labels: {
    addRow: string;
    copy: string;
    templateDownload: string;
    upload: string;
    download: string;
    saveAll: string;
    saveDone: string;
    saveFailed: string;
    validationError: string;
  };
};

export function useEmployeeMasterActions({
  rows,
  appliedQuery,
  saving,
  departmentsReady,
  gridApiRef,
  containerRef,
  uploadInputRef,
  departmentNameById,
  positionNames,
  employmentLabelByCode,
  issueTempId,
  createEmptyRow,
  parseDepartmentId,
  commitRows,
  mutateEmployeePage,
  setSaving,
  setSyncedPageKey,
  snapshotOriginal,
  validateRow,
  labels,
}: UseEmployeeMasterActionsArgs) {
  const addRows = useCallback((count: number) => {
    const added = Array.from({ length: count }, () => createEmptyRow());
    commitRows((prev) => [...added, ...prev]);
  }, [commitRows, createEmptyRow]);

  const handlePasteCapture = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(document.activeElement)) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text || !text.includes("\t")) return;

    event.preventDefault();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) return;

    const parsed: EmployeeGridRow[] = lines.map((line) => {
      const cells = line.split("\t").map((value) => value.trim());
      const departmentId = parseDepartmentId(cells[1] ?? "");
      return {
        id: issueTempId(),
        employee_no: "",
        login_id: "",
        display_name: cells[0] ?? "",
        department_id: departmentId,
        department_name: departmentNameById.get(departmentId) ?? "",
        position_title: cells[2] || "사원",
        hire_date: (cells[3] || new Date().toISOString().slice(0, 10)).slice(0, 10),
        employment_status: cells[4] === "leave" || cells[4] === "휴직" ? "leave" : cells[4] === "resigned" || cells[4] === "퇴직" ? "resigned" : "active",
        email: cells[5] || "",
        is_active: ["y", "yes", "true", "1"].includes((cells[6] || "Y").trim().toLowerCase()),
        password: cells[7] || "admin",
        _status: "added",
      };
    });

    commitRows((prev) => [...parsed, ...prev]);
  }, [commitRows, containerRef, departmentNameById, issueTempId, parseDepartmentId]);

  const copySelectedRows = useCallback(() => {
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
          _original: undefined,
          _prevStatus: undefined,
        },
      ]),
    );

    commitRows((prev) => {
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
  }, [commitRows, gridApiRef, issueTempId]);

  const downloadTemplateExcel = useCallback(async () => {
    try {
      const headers = ["사번", "이름", "부서코드(또는 부서명)", "직책", "입사일", "재직상태", "이메일", "활성(Y/N)", "비밀번호"];
      const sample = ["", "홍길동", "HQ-HR", "사원", "2026-01-01", "active", "hong@vibe-hr.local", "Y", "admin"];
      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, sample]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "업로드양식");
      writeFileXLSX(book, "employee-upload-template.xlsx");
    } catch {
      toast.error("양식 다운로드에 실패했습니다.");
    }
  }, []);

  const downloadCurrentSheetExcel = useCallback(async () => {
    try {
      const headers = ["사번", "로그인ID", "이름", "부서", "직책", "입사일", "재직상태", "이메일", "활성"];
      const query = new URLSearchParams(appliedQuery);
      query.set("all", "true");
      const response = await fetch(`/api/employees?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("다운로드 조회 실패");
      const json = (await response.json()) as { employees: EmployeeItem[] };
      const data = (json.employees ?? []).map((row) => [
        row.employee_no,
        row.login_id,
        row.display_name,
        row.department_name || "",
        row.position_title,
        row.hire_date,
        toDisplayEmploymentStatus(row.employment_status, employmentLabelByCode),
        row.email,
        row.is_active ? "Y" : "N",
      ]);

      const { utils, writeFileXLSX } = await import("xlsx");
      const sheet = utils.aoa_to_sheet([headers, ...data]);
      const book = utils.book_new();
      utils.book_append_sheet(book, sheet, "사원관리");
      writeFileXLSX(book, `employee-sheet-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  }, [appliedQuery, employmentLabelByCode]);

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsAoa = utils.sheet_to_json<(string | number | boolean)[]>(firstSheet, { header: 1, raw: false });
      if (!rowsAoa || rowsAoa.length <= 1) return;

      const parsed: EmployeeGridRow[] = [];
      for (const cells of rowsAoa.slice(1)) {
        const values = cells.map((value) => String(value ?? "").trim());
        if (!values.some((value) => value.length > 0)) continue;
        const departmentId = parseDepartmentId(values[2] ?? "");
        parsed.push({
          id: issueTempId(),
          employee_no: values[0] ?? "",
          login_id: "",
          display_name: values[1] ?? "",
          department_id: departmentId,
          department_name: departmentNameById.get(departmentId) ?? "",
          position_title: values[3] || positionNames[0] || "사원",
          hire_date: (values[4] || new Date().toISOString().slice(0, 10)).slice(0, 10),
          employment_status: values[5] === "leave" || values[5] === "휴직" ? "leave" : values[5] === "resigned" || values[5] === "퇴직" ? "resigned" : "active",
          email: values[6] || "",
          is_active: ["y", "yes", "true", "1"].includes((values[7] || "Y").trim().toLowerCase()),
          password: values[8] || "admin",
          _status: "added",
        });
      }

      commitRows((prev) => [...parsed, ...prev]);
    } catch {
      toast.error("엑셀 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요.");
    }
  }, [commitRows, departmentNameById, issueTempId, parseDepartmentId, positionNames]);

  const saveAllChanges = useCallback(async () => {
    const changedRows = rows.filter((row) => row._status !== "clean");
    if (changedRows.length === 0) return;

    const validationErrors = new Map<number, string>();
    for (const row of rows.filter((candidate) => candidate._status === "added" || candidate._status === "updated")) {
      const message = validateRow(row);
      if (message) validationErrors.set(row.id, message);
    }
    if (validationErrors.size > 0) {
      const details = Array.from(validationErrors.entries()).slice(0, 5).map(([id, message]) => `ID ${id}: ${message}`).join(" / ");
      toast.error(`${labels.validationError} ${details}`);
      return;
    }

    setSaving(true);
    try {
      const payload = buildEmployeeBatchPayload(rows);
      const response = await fetch("/api/employees/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await parseErrorDetail(response, labels.saveFailed);
        toast.error(detail);
        return;
      }

      const json = (await response.json()) as EmployeeBatchResponse;
      commitRows((prev) =>
        clearSavedStatuses(prev, {
          removeDeleted: true,
          buildOriginal: (row) => snapshotOriginal(row),
        }),
      );
      gridApiRef.current?.deselectAll();
      gridApiRef.current?.stopEditing();
      toast.success(`${labels.saveDone} (입력 ${json.inserted_count}건 / 수정 ${json.updated_count}건 / 삭제 ${json.deleted_count}건)`);

      try {
        setSyncedPageKey(null);
        await mutateEmployeePage();
      } catch {
        toast.warning("저장은 완료되었지만 목록 재조회에 실패했습니다.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.saveFailed);
    } finally {
      setSaving(false);
    }
  }, [commitRows, gridApiRef, labels.saveDone, labels.saveFailed, labels.validationError, mutateEmployeePage, rows, setSaving, setSyncedPageKey, snapshotOriginal, validateRow]);

  const toolbarActions = useMemo(() => [
    { key: "add", label: labels.addRow, icon: Plus, onClick: () => addRows(1), disabled: !departmentsReady },
    { key: "copy", label: labels.copy, icon: Copy, onClick: copySelectedRows },
    { key: "template", label: labels.templateDownload, icon: FileDown, onClick: () => void downloadTemplateExcel() },
    { key: "upload", label: labels.upload, icon: Upload, onClick: () => uploadInputRef.current?.click() },
    { key: "download", label: labels.download, icon: Download, onClick: () => void downloadCurrentSheetExcel() },
  ], [addRows, copySelectedRows, departmentsReady, downloadCurrentSheetExcel, downloadTemplateExcel, labels.addRow, labels.copy, labels.download, labels.templateDownload, labels.upload, uploadInputRef]);

  const toolbarSaveAction = useMemo(() => ({
    key: "save",
    label: saving ? `${labels.saveAll}...` : labels.saveAll,
    icon: Save,
    onClick: saveAllChanges,
    disabled: saving,
    variant: "save" as const,
  }), [labels.saveAll, saveAllChanges, saving]);

  return { toolbarActions, toolbarSaveAction, handlePasteCapture, handleUploadFile };
}
