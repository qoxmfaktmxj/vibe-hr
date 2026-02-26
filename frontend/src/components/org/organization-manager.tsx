"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridApi } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type OrgRow = OrganizationDepartmentItem & {
  delete_mark?: boolean;
  row_status?: "" | "입력" | "수정" | "삭제";
  _dirty?: boolean;
};

export function OrganizationManager() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const gridApiRef = useRef<GridApi<OrgRow> | null>(null);
  const tempIdRef = useRef(-1);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  const columns: ColDef<OrgRow>[] = [
    { field: "delete_mark", headerName: "삭제", editable: true, width: 72, cellDataType: "boolean" },
    {
      field: "row_status",
      headerName: "상태",
      width: 90,
      valueGetter: (p) => (p.data?.delete_mark ? "삭제" : p.data?.row_status || ""),
    },
    { field: "code", headerName: "조직코드", editable: true, flex: 1, minWidth: 160 },
    { field: "name", headerName: "조직명", editable: true, flex: 1.2, minWidth: 180 },
    { field: "parent_name", headerName: "상위조직", editable: false, flex: 1.2, minWidth: 180 },
    {
      field: "is_active",
      headerName: "사용",
      editable: true,
      width: 100,
      cellDataType: "boolean",
      valueFormatter: (p) => (p.value ? "Y" : "N"),
    },
    { field: "updated_at", headerName: "수정일", minWidth: 180, valueFormatter: (p) => new Date(p.value).toLocaleString() },
  ];

  const fetchDepartments = useCallback(async () => {
    const params = new URLSearchParams();
    if (searchCode.trim()) params.set("code", searchCode.trim());
    if (searchName.trim()) params.set("name", searchName.trim());
    if (referenceDate.trim()) params.set("reference_date", referenceDate.trim());

    const endpoint = params.size > 0 ? `/api/org/departments?${params.toString()}` : "/api/org/departments";
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(data?.detail ?? "조직 목록을 불러오지 못했습니다.");
    }

    const data = (await res.json()) as OrganizationDepartmentListResponse;
    return data.departments;
  }, [referenceDate, searchCode, searchName]);

  const runQuery = useCallback(async () => {
    setLoading(true);
    try {
      const departments = await fetchDepartments();
      setRows(
        departments.map((department) => ({
          ...department,
          delete_mark: false,
          row_status: "",
          _dirty: false,
        })),
      );
      setSelectedId(departments[0]?.id ?? null);
      setNoticeType("success");
      setNotice("조회 완료");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [fetchDepartments]);

  useEffect(() => {
    void runQuery();
  }, [runQuery]);

  function addRow() {
    const newId = tempIdRef.current;
    tempIdRef.current -= 1;
    const now = new Date().toISOString();
    const newRow: OrgRow = {
      id: newId,
      code: "",
      name: "",
      parent_id: null,
      parent_name: null,
      is_active: true,
      created_at: now,
      updated_at: now,
      delete_mark: false,
      row_status: "입력",
      _dirty: true,
    };

    setRows((prev) => [newRow, ...prev]);
    setSelectedId(newId);
    setNotice(null);
    setNoticeType(null);
  }

  function copyRow() {
    if (!selectedRow) return;
    const newId = tempIdRef.current;
    tempIdRef.current -= 1;

    const copied: OrgRow = {
      ...selectedRow,
      id: newId,
      code: `${selectedRow.code}_COPY`,
      row_status: "입력",
      _dirty: true,
      delete_mark: false,
    };

    setRows((prev) => {
      const index = prev.findIndex((row) => row.id === selectedRow.id);
      if (index < 0) return [copied, ...prev];
      return [...prev.slice(0, index + 1), copied, ...prev.slice(index + 1)];
    });
    setSelectedId(newId);
  }

  function downloadTemplate() {
    setNoticeType("success");
    setNotice("양식다운로드는 다음 단계에서 xlsx 템플릿 파일로 연결합니다.");
  }

  function uploadTemplate() {
    setNoticeType("success");
    setNotice("업로드는 다음 단계에서 템플릿 헤더 매핑으로 연결합니다.");
  }

  async function saveAll() {
    setSaving(true);
    try {
      const toDelete = rows.filter((row) => row.delete_mark && row.id > 0);
      const toInsert = rows.filter((row) => row.id < 0 && !row.delete_mark);
      const toUpdate = rows.filter((row) => row.id > 0 && row._dirty && !row.delete_mark);

      for (const row of toDelete) {
        const response = await fetch(`/api/org/departments/${row.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(`삭제 실패: ${row.code}`);
      }

      for (const row of toUpdate) {
        const response = await fetch(`/api/org/departments/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: row.code,
            name: row.name,
            parent_id: row.parent_id,
            is_active: row.is_active,
          }),
        });
        if (!response.ok) throw new Error(`수정 실패: ${row.code}`);
      }

      for (const row of toInsert) {
        const response = await fetch(`/api/org/departments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: row.code,
            name: row.name,
            parent_id: row.parent_id,
            is_active: row.is_active,
          }),
        });
        if (!response.ok) throw new Error(`입력 실패: ${row.code || "(신규)"}`);
      }

      setNoticeType("success");
      setNotice(`저장 완료 (삭제 ${toDelete.length}건 / 수정 ${toUpdate.length}건 / 입력 ${toInsert.length}건)`);
      await runQuery();
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "저장 실패");
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>조직코드관리</CardTitle>
            <div className="flex justify-end gap-2">
              <Button variant="query" onClick={() => void runQuery()} disabled={saving}>조회</Button>
              <Button variant="outline" onClick={addRow} disabled={saving}>입력</Button>
              <Button variant="outline" onClick={copyRow} disabled={saving || !selectedRow}>복사</Button>
              <Button variant="outline" onClick={downloadTemplate} disabled={saving}>양식다운로드</Button>
              <Button variant="outline" onClick={uploadTemplate} disabled={saving}>업로드</Button>
              <Button variant="save" onClick={() => void saveAll()} disabled={saving}>저장</Button>
              <Button variant="outline" onClick={() => gridApiRef.current?.exportDataAsCsv({ fileName: "org-codes.csv" })} disabled={saving}>다운로드</Button>
            </div>
          </div>
          {notice ? <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p> : null}
        </CardHeader>

        <CardContent>
          <div className="ag-theme-quartz" style={{ height: 620 }}>
            <AgGridReact<OrgRow>
              rowData={rows}
              columnDefs={columns}
              getRowId={(params) => String(params.data.id)}
              rowSelection={{ mode: "singleRow", checkboxes: false }}
              onGridReady={(event) => {
                gridApiRef.current = event.api;
              }}
              onRowClicked={(event) => {
                if (!event.data) return;
                setSelectedId(event.data.id);
              }}
              onCellValueChanged={(event) => {
                if (!event.data) return;
                const row = event.data;
                setRows((prev) =>
                  prev.map((item) =>
                    item.id === row.id
                      ? {
                          ...row,
                          _dirty: true,
                          row_status: row.id < 0 ? "입력" : row.delete_mark ? "삭제" : "수정",
                        }
                      : item,
                  ),
                );
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
