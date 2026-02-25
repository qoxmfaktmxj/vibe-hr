"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridApi } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import type {
  OrganizationDepartmentDetailResponse,
  OrganizationDepartmentItem,
  OrganizationDepartmentListResponse,
} from "@/types/organization";

let registered = false;
if (!registered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  registered = true;
}

type DepartmentFormState = {
  code: string;
  name: string;
  parent_id: string;
  is_active: boolean;
};

const EMPTY_FORM: DepartmentFormState = {
  code: "",
  name: "",
  parent_id: "",
  is_active: true,
};

export function OrganizationManager() {
  const [departments, setDepartments] = useState<OrganizationDepartmentItem[]>([]);
  const [allDepartments, setAllDepartments] = useState<OrganizationDepartmentItem[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [form, setForm] = useState<DepartmentFormState>(EMPTY_FORM);
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const gridApiRef = useRef<GridApi<OrganizationDepartmentItem> | null>(null);

  const selectedDepartment = useMemo(
    () => allDepartments.find((department) => department.id === selectedDepartmentId) ?? null,
    [allDepartments, selectedDepartmentId],
  );

  const parentOptions = useMemo(
    () => allDepartments.filter((department) => department.id !== selectedDepartmentId),
    [allDepartments, selectedDepartmentId],
  );

  const columns: ColDef<OrganizationDepartmentItem>[] = [
    { field: "code", headerName: "조직코드", flex: 1, minWidth: 160 },
    { field: "name", headerName: "조직명", flex: 1.3, minWidth: 200 },
    { field: "parent_name", headerName: "상위조직", flex: 1.2, minWidth: 180 },
    { field: "is_active", headerName: "사용", width: 100, valueFormatter: (p) => (p.value ? "Y" : "N") },
    { field: "updated_at", headerName: "수정일", minWidth: 180, valueFormatter: (p) => new Date(p.value).toLocaleString() },
  ];

  const fetchDepartments = useCallback(
    async (filtered: boolean) => {
      const params = new URLSearchParams();
      if (filtered && searchCode.trim()) params.set("code", searchCode.trim());
      if (filtered && searchName.trim()) params.set("name", searchName.trim());
      if (referenceDate.trim()) params.set("reference_date", referenceDate.trim());

      const endpoint = params.size > 0 ? `/api/org/departments?${params.toString()}` : "/api/org/departments";
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "조직 목록을 불러오지 못했습니다.");
      }

      const data = (await res.json()) as OrganizationDepartmentListResponse;
      return data.departments;
    },
    [referenceDate, searchCode, searchName],
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [filteredDepartments, fullDepartments] = await Promise.all([
        fetchDepartments(true),
        fetchDepartments(false),
      ]);
      setDepartments(filteredDepartments);
      setAllDepartments(fullDepartments);
      setSelectedDepartmentId((prev) => {
        if (prev && fullDepartments.some((department) => department.id === prev)) return prev;
        return filteredDepartments[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [fetchDepartments]);

  useEffect(() => {
    void (async () => {
      try {
        await loadBase();
      } catch (error) {
        setNoticeType("error");
        setNotice(error instanceof Error ? error.message : "초기 로딩에 실패했습니다.");
        setLoading(false);
      }
    })();
  }, [loadBase]);

  useEffect(() => {
    if (isCreateMode) {
      setForm(EMPTY_FORM);
      return;
    }
    if (!selectedDepartment) return;

    setForm({
      code: selectedDepartment.code,
      name: selectedDepartment.name,
      parent_id: selectedDepartment.parent_id ? String(selectedDepartment.parent_id) : "",
      is_active: selectedDepartment.is_active,
    });
  }, [isCreateMode, selectedDepartment]);

  function runSearch() {
    void loadBase();
  }

  function startCreate() {
    setIsCreateMode(true);
    setSelectedDepartmentId(null);
    setNotice(null);
    setNoticeType(null);
  }

  function copyDepartment() {
    if (!selectedDepartment) return;
    setIsCreateMode(true);
    setSelectedDepartmentId(null);
    setForm({
      code: `${selectedDepartment.code}_COPY`,
      name: `${selectedDepartment.name} 복사`,
      parent_id: selectedDepartment.parent_id ? String(selectedDepartment.parent_id) : "",
      is_active: selectedDepartment.is_active,
    });
  }

  async function saveDepartment() {
    if (!form.code.trim()) {
      setNoticeType("error");
      setNotice("조직코드를 입력하세요.");
      return;
    }
    if (!form.name.trim()) {
      setNoticeType("error");
      setNotice("조직명을 입력하세요.");
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        is_active: form.is_active,
      };

      const res = await fetch(isCreateMode ? "/api/org/departments" : `/api/org/departments/${selectedDepartmentId}`, {
        method: isCreateMode ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | OrganizationDepartmentDetailResponse
        | { detail?: string }
        | null;

      if (!res.ok) {
        throw new Error((data as { detail?: string } | null)?.detail ?? "저장 실패");
      }

      await loadBase();
      if (data && "department" in data) {
        setSelectedDepartmentId(data.department.id);
      }
      setIsCreateMode(false);
      setNoticeType("success");
      setNotice("저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDepartment() {
    if (!selectedDepartmentId || isCreateMode) return;
    if (!confirm("선택한 조직을 삭제하시겠습니까?")) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/org/departments/${selectedDepartmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "삭제 실패");
      }

      await loadBase();
      setIsCreateMode(false);
      setSelectedDepartmentId(null);
      setNoticeType("success");
      setNotice("삭제가 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">불러오는 중...</div>;

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="mr-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Search className="h-4 w-4 text-primary" /> Search
            </div>
            <div className="space-y-1">
              <Label className="text-xs">조직코드</Label>
              <Input className="h-9 w-36" value={searchCode} onChange={(event) => setSearchCode(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">조직명</Label>
              <Input className="h-9 w-44" value={searchName} onChange={(event) => setSearchName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">기준일자</Label>
              <CustomDatePicker className="w-40" value={referenceDate} onChange={setReferenceDate} holidays={HOLIDAY_DATE_KEYS} />
            </div>
            <Button variant="query" className="h-9 px-5" onClick={runSearch}>조회</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>조직코드관리</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => gridApiRef.current?.exportDataAsCsv({ fileName: "org-codes.csv" })}>엑셀 다운로드</Button>
            <Button variant="outline" onClick={copyDepartment} disabled={!selectedDepartmentId || isCreateMode}>복사</Button>
            <Button variant="outline" onClick={startCreate} disabled={saving}>입력</Button>
            <Button variant="save" onClick={saveDepartment} disabled={saving}>저장</Button>
            <Button variant="destructive" onClick={removeDepartment} disabled={saving || !selectedDepartmentId}>삭제</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice ? <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p> : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <div className="ag-theme-quartz" style={{ height: 560 }}>
                <AgGridReact<OrganizationDepartmentItem>
                  rowData={departments}
                  columnDefs={columns}
                  getRowId={(params) => String(params.data.id)}
                  rowSelection={{ mode: "singleRow", checkboxes: false }}
                  onGridReady={(event) => {
                    gridApiRef.current = event.api;
                  }}
                  onRowClicked={(event) => {
                    if (!event.data) return;
                    setIsCreateMode(false);
                    setSelectedDepartmentId(event.data.id);
                    setNotice(null);
                    setNoticeType(null);
                  }}
                />
              </div>
            </div>

            <div className="xl:col-span-2">
              <div className="space-y-4 rounded-md border p-4">
                <h3 className="text-sm font-semibold text-slate-700">{isCreateMode ? "신규 조직 입력" : "조직 상세"}</h3>

                <div className="space-y-2">
                  <Label>조직코드</Label>
                  <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>조직명</Label>
                  <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>상위조직</Label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                    value={form.parent_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
                  >
                    <option value="">(최상위)</option>
                    {parentOptions.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name} ({department.code})
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.is_active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: Boolean(checked) }))} />
                  사용여부
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
