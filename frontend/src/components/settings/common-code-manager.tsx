"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { ensureAgGridRegistered } from "@/lib/ag-grid";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CodeDetailResponse,
  CodeGroupDetailResponse,
  CodeGroupItem,
  CodeGroupListResponse,
  CodeItem,
  CodeListResponse,
} from "@/types/common-code";

ensureAgGridRegistered();

const T = {
  loading: "공통코드를 불러오는 중...",
  loadGroupsError: "코드 그룹을 불러오지 못했습니다.",
  initLoadError: "초기 로딩에 실패했습니다.",
  saveFailed: "저장에 실패했습니다.",
  deleteFailed: "삭제에 실패했습니다.",
  groupSaved: "그룹코드 저장이 완료되었습니다.",
  groupDeleted: "그룹코드 삭제가 완료되었습니다.",
  codeSaved: "세부코드 저장이 완료되었습니다.",
  codeDeleted: "세부코드 삭제가 완료되었습니다.",
  askDeleteGroup:
    "선택한 그룹코드를 삭제하시겠습니까? 하위 세부코드도 함께 삭제됩니다.",
  askDeleteCode: "선택한 세부코드를 삭제하시겠습니까?",
  copySuffix: " 복사",
  groupCode: "그룹코드",
  groupName: "그룹코드명",
  query: "조회",
  groupManage: "그룹코드 관리",
  codeName: "코드명",
  codeDesc: "코드설명",
  use: "사용",
  order: "순서",
  sortOrder: "정렬순서",
  download: "다운로드",
  copy: "복사",
  input: "입력",
  save: "저장",
  delete: "삭제",
  detailCode: "세부코드",
  detailCodeName: "세부코드명",
  detailManage: "세부코드 관리",
  engName: "영문명",
  note1: "비고1",
  note2: "비고2",
};

const EMPTY_GROUP = {
  code: "",
  name: "",
  description: "",
  sort_order: "0",
  is_active: true,
};

const EMPTY_CODE = {
  code: "",
  name: "",
  description: "",
  sort_order: "0",
  is_active: true,
  extra_value1: "",
  extra_value2: "",
};

function toCsvCell(value: string | number | boolean) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | boolean>>) {
  const text = [
    headers.map((header) => toCsvCell(header)).join(","),
    ...rows.map((row) => row.map((value) => toCsvCell(value)).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CommonCodeManager() {
  const [groups, setGroups] = useState<CodeGroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [codes, setCodes] = useState<CodeItem[]>([]);
  const [selectedCodeId, setSelectedCodeId] = useState<number | null>(null);

  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
  const [codeForm, setCodeForm] = useState(EMPTY_CODE);

  const [groupCreateMode, setGroupCreateMode] = useState(false);
  const [codeCreateMode, setCodeCreateMode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const [groupCodeQuery, setGroupCodeQuery] = useState("");
  const [groupNameQuery, setGroupNameQuery] = useState("");
  const [detailCodeQuery, setDetailCodeQuery] = useState("");
  const [detailNameQuery, setDetailNameQuery] = useState("");

  const groupGridApiRef = useRef<GridApi<CodeGroupItem> | null>(null);
  const detailGridApiRef = useRef<GridApi<CodeItem> | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );
  const selectedCode = useMemo(
    () => codes.find((code) => code.id === selectedCodeId) ?? null,
    [codes, selectedCodeId],
  );

  const filteredGroups = useMemo(() => {
    const codeQuery = groupCodeQuery.trim().toLowerCase();
    const nameQuery = groupNameQuery.trim().toLowerCase();

    return groups.filter((group) => {
      const byCode = !codeQuery || group.code.toLowerCase().includes(codeQuery);
      const byName = !nameQuery || group.name.toLowerCase().includes(nameQuery);
      return byCode && byName;
    });
  }, [groupCodeQuery, groupNameQuery, groups]);

  const filteredCodes = useMemo(() => {
    const codeQuery = detailCodeQuery.trim().toLowerCase();
    const nameQuery = detailNameQuery.trim().toLowerCase();

    return codes.filter((code) => {
      const byCode = !codeQuery || code.code.toLowerCase().includes(codeQuery);
      const byName = !nameQuery || code.name.toLowerCase().includes(nameQuery);
      return byCode && byName;
    });
  }, [codes, detailCodeQuery, detailNameQuery]);

  const groupColumnDefs = useMemo<ColDef<CodeGroupItem>[]>(
    () => [
      {
        headerName: "No",
        width: 72,
        sortable: false,
        filter: false,
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      },
      {
        headerName: T.groupCode,
        field: "code",
        width: 170,
      },
      {
        headerName: T.codeName,
        field: "name",
        width: 200,
      },
      {
        headerName: T.codeDesc,
        field: "description",
        flex: 1,
        minWidth: 220,
      },
      {
        headerName: T.use,
        field: "is_active",
        width: 100,
        valueFormatter: (params) => (params.value ? "Y" : "N"),
      },
      {
        headerName: T.order,
        field: "sort_order",
        width: 100,
      },
    ],
    [],
  );

  const detailColumnDefs = useMemo<ColDef<CodeItem>[]>(
    () => [
      {
        headerName: "No",
        width: 72,
        sortable: false,
        filter: false,
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      },
      {
        headerName: T.detailCode,
        field: "code",
        width: 170,
      },
      {
        headerName: T.detailCodeName,
        field: "name",
        width: 220,
      },
      {
        headerName: T.order,
        field: "sort_order",
        width: 100,
      },
      {
        headerName: T.use,
        field: "is_active",
        width: 100,
        valueFormatter: (params) => (params.value ? "Y" : "N"),
      },
      {
        headerName: T.note1,
        field: "extra_value1",
        width: 180,
      },
      {
        headerName: T.note2,
        field: "extra_value2",
        flex: 1,
        minWidth: 180,
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, filter: true, resizable: true }), []);

  async function loadGroups() {
    const res = await fetch("/api/codes/groups", { cache: "no-store" });
    if (!res.ok) throw new Error(T.loadGroupsError);
    const data = (await res.json()) as CodeGroupListResponse;
    setGroups(data.groups);
    setSelectedGroupId((prev) => prev ?? data.groups[0]?.id ?? null);
  }

  async function loadCodes(groupId: number) {
    const res = await fetch(`/api/codes/groups/${groupId}/items`, { cache: "no-store" });
    if (!res.ok) {
      setCodes([]);
      setSelectedCodeId(null);
      return;
    }
    const data = (await res.json()) as CodeListResponse;
    setCodes(data.codes);
    setSelectedCodeId((prev) => prev ?? data.codes[0]?.id ?? null);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadGroups();
      } catch (error) {
        setNoticeType("error");
        setNotice(error instanceof Error ? error.message : T.initLoadError);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedGroupId) {
      setCodes([]);
      return;
    }
    void loadCodes(selectedGroupId);
  }, [selectedGroupId]);

  useEffect(() => {
    if (groupCreateMode) {
      setGroupForm(EMPTY_GROUP);
      return;
    }
    if (!selectedGroup) return;
    setGroupForm({
      code: selectedGroup.code,
      name: selectedGroup.name,
      description: selectedGroup.description ?? "",
      sort_order: String(selectedGroup.sort_order),
      is_active: selectedGroup.is_active,
    });
  }, [groupCreateMode, selectedGroup]);

  useEffect(() => {
    if (codeCreateMode) {
      setCodeForm(EMPTY_CODE);
      return;
    }
    if (!selectedCode) return;
    setCodeForm({
      code: selectedCode.code,
      name: selectedCode.name,
      description: selectedCode.description ?? "",
      sort_order: String(selectedCode.sort_order),
      is_active: selectedCode.is_active,
      extra_value1: selectedCode.extra_value1 ?? "",
      extra_value2: selectedCode.extra_value2 ?? "",
    });
  }, [codeCreateMode, selectedCode]);

  useEffect(() => {
    if (!groupGridApiRef.current) return;
    groupGridApiRef.current.forEachNode((node) => {
      node.setSelected(!groupCreateMode && node.data?.id === selectedGroupId);
    });
  }, [filteredGroups, groupCreateMode, selectedGroupId]);

  useEffect(() => {
    if (!detailGridApiRef.current) return;
    detailGridApiRef.current.forEachNode((node) => {
      node.setSelected(!codeCreateMode && node.data?.id === selectedCodeId);
    });
  }, [codeCreateMode, filteredCodes, selectedCodeId]);

  const onGroupGridReady = useCallback((event: GridReadyEvent<CodeGroupItem>) => {
    groupGridApiRef.current = event.api;
  }, []);

  const onDetailGridReady = useCallback((event: GridReadyEvent<CodeItem>) => {
    detailGridApiRef.current = event.api;
  }, []);

  const onGroupRowClicked = useCallback((event: RowClickedEvent<CodeGroupItem>) => {
    if (!event.data) return;
    setGroupCreateMode(false);
    setSelectedGroupId(event.data.id);
    setNotice(null);
  }, []);

  const onDetailRowClicked = useCallback((event: RowClickedEvent<CodeItem>) => {
    if (!event.data) return;
    setCodeCreateMode(false);
    setSelectedCodeId(event.data.id);
  }, []);

  function copyGroup() {
    if (!selectedGroup) return;
    setGroupCreateMode(true);
    setSelectedGroupId(null);
    setGroupForm({
      code: `${selectedGroup.code}_COPY`,
      name: `${selectedGroup.name}${T.copySuffix}`,
      description: selectedGroup.description ?? "",
      sort_order: String(selectedGroup.sort_order),
      is_active: selectedGroup.is_active,
    });
  }

  function copyCode() {
    if (!selectedCode) return;
    setCodeCreateMode(true);
    setSelectedCodeId(null);
    setCodeForm({
      code: `${selectedCode.code}_COPY`,
      name: `${selectedCode.name}${T.copySuffix}`,
      description: selectedCode.description ?? "",
      sort_order: String(selectedCode.sort_order),
      is_active: selectedCode.is_active,
      extra_value1: selectedCode.extra_value1 ?? "",
      extra_value2: selectedCode.extra_value2 ?? "",
    });
  }

  async function saveGroup() {
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        code: groupForm.code.trim(),
        name: groupForm.name.trim(),
        description: groupForm.description || null,
        sort_order: Number(groupForm.sort_order || 0),
        is_active: groupForm.is_active,
      };

      const res = await fetch(groupCreateMode ? "/api/codes/groups" : `/api/codes/groups/${selectedGroupId}`, {
        method: groupCreateMode ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as CodeGroupDetailResponse | { detail?: string } | null;
      if (!res.ok) throw new Error((data as { detail?: string } | null)?.detail ?? T.saveFailed);

      await loadGroups();
      if (data && "group" in data) setSelectedGroupId(data.group.id);
      setGroupCreateMode(false);
      setNoticeType("success");
      setNotice(T.groupSaved);
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : T.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!selectedGroupId || groupCreateMode) return;
    if (!confirm(T.askDeleteGroup)) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/codes/groups/${selectedGroupId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? T.deleteFailed);
      }
      await loadGroups();
      setSelectedGroupId(null);
      setCodes([]);
      setNoticeType("success");
      setNotice(T.groupDeleted);
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : T.deleteFailed);
    } finally {
      setSaving(false);
    }
  }

  async function saveCode() {
    if (!selectedGroupId) return;

    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        code: codeForm.code.trim(),
        name: codeForm.name.trim(),
        description: codeForm.description || null,
        sort_order: Number(codeForm.sort_order || 0),
        is_active: codeForm.is_active,
        extra_value1: codeForm.extra_value1 || null,
        extra_value2: codeForm.extra_value2 || null,
      };

      const endpoint = codeCreateMode
        ? `/api/codes/groups/${selectedGroupId}/items`
        : `/api/codes/groups/${selectedGroupId}/items/${selectedCodeId}`;

      const res = await fetch(endpoint, {
        method: codeCreateMode ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as CodeDetailResponse | { detail?: string } | null;
      if (!res.ok) throw new Error((data as { detail?: string } | null)?.detail ?? T.saveFailed);

      await loadCodes(selectedGroupId);
      if (data && "code" in data) setSelectedCodeId(data.code.id);
      setCodeCreateMode(false);
      setNoticeType("success");
      setNotice(T.codeSaved);
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : T.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCode() {
    if (!selectedGroupId || !selectedCodeId || codeCreateMode) return;
    if (!confirm(T.askDeleteCode)) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/codes/groups/${selectedGroupId}/items/${selectedCodeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? T.deleteFailed);
      }
      await loadCodes(selectedGroupId);
      setSelectedCodeId(null);
      setNoticeType("success");
      setNotice(T.codeDeleted);
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : T.deleteFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">{T.loading}</div>;

  return (
    <div className="space-y-4 p-6">
      {notice ? (
        <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">{T.groupCode}</Label>
              <Input
                placeholder={`${T.groupCode} ${T.input}`}
                value={groupCodeQuery}
                onChange={(e) => setGroupCodeQuery(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{T.groupName}</Label>
              <Input
                placeholder={`${T.groupName} ${T.input}`}
                value={groupNameQuery}
                onChange={(e) => setGroupNameQuery(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="button">{T.query}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{T.groupManage}</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "group-codes.csv",
                  [T.groupCode, T.codeName, T.codeDesc, T.use, T.order],
                  filteredGroups.map((group) => [
                    group.code,
                    group.name,
                    group.description ?? "",
                    group.is_active ? "Y" : "N",
                    group.sort_order,
                  ]),
                )
              }
            >
              {T.download}
            </Button>
            <Button size="sm" variant="outline" onClick={copyGroup} disabled={!selectedGroup}>
              {T.copy}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setGroupCreateMode(true);
                setSelectedGroupId(null);
                setNotice(null);
              }}
            >
              {T.input}
            </Button>
            <Button size="sm" onClick={saveGroup} disabled={saving}>
              {T.save}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={deleteGroup}
              disabled={saving || !selectedGroupId || groupCreateMode}
            >
              {T.delete}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="ag-theme-alpine h-[300px] w-full rounded-md border">
            <AgGridReact<CodeGroupItem>
              rowData={filteredGroups}
              columnDefs={groupColumnDefs}
              defaultColDef={defaultColDef}
              rowSelection="single"
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGroupGridReady}
              onRowClicked={onGroupRowClicked}
              overlayNoRowsTemplate="<span>조회된 그룹코드가 없습니다.</span>"
            />
          </div>
          <div className="text-right text-xs text-slate-500">
            [{filteredGroups.length} / {groups.length}]
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{T.groupCode}</Label>
              <Input
                value={groupForm.code}
                onChange={(e) => setGroupForm((p) => ({ ...p, code: e.target.value }))}
                disabled={!groupCreateMode}
              />
            </div>
            <div className="space-y-1">
              <Label>{T.groupName}</Label>
              <Input value={groupForm.name} onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{T.codeDesc}</Label>
              <Input
                value={groupForm.description}
                onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{T.sortOrder}</Label>
              <Input
                type="number"
                value={groupForm.sort_order}
                onChange={(e) => setGroupForm((p) => ({ ...p, sort_order: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={groupForm.is_active}
              onCheckedChange={(value) => setGroupForm((p) => ({ ...p, is_active: Boolean(value) }))}
            />
            {T.use}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">{T.detailCode}</Label>
              <Input
                placeholder={`${T.detailCode} ${T.input}`}
                value={detailCodeQuery}
                onChange={(e) => setDetailCodeQuery(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{T.detailCodeName}</Label>
              <Input
                placeholder={`${T.detailCodeName} ${T.input}`}
                value={detailNameQuery}
                onChange={(e) => setDetailNameQuery(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="button">{T.query}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {T.detailManage} {selectedGroup ? `(${selectedGroup.name})` : ""}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "detail-codes.csv",
                  [T.detailCode, T.detailCodeName, T.order, T.use],
                  filteredCodes.map((code) => [code.code, code.name, code.sort_order, code.is_active ? "Y" : "N"]),
                )
              }
              disabled={!selectedGroupId}
            >
              {T.download}
            </Button>
            <Button size="sm" variant="outline" onClick={copyCode} disabled={!selectedCode}>
              {T.copy}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCodeCreateMode(true);
                setSelectedCodeId(null);
              }}
              disabled={!selectedGroupId}
            >
              {T.input}
            </Button>
            <Button size="sm" onClick={saveCode} disabled={saving || !selectedGroupId}>
              {T.save}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={deleteCode}
              disabled={saving || !selectedCodeId || codeCreateMode}
            >
              {T.delete}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="ag-theme-alpine h-[320px] w-full rounded-md border">
            <AgGridReact<CodeItem>
              rowData={filteredCodes}
              columnDefs={detailColumnDefs}
              defaultColDef={defaultColDef}
              rowSelection="single"
              getRowId={(params) => String(params.data.id)}
              onGridReady={onDetailGridReady}
              onRowClicked={onDetailRowClicked}
              overlayNoRowsTemplate="<span>선택한 그룹코드의 세부코드가 없습니다.</span>"
            />
          </div>
          <div className="text-right text-xs text-slate-500">
            [{filteredCodes.length} / {codes.length}]
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label>{T.detailCode}</Label>
              <Input
                value={codeForm.code}
                onChange={(e) => setCodeForm((p) => ({ ...p, code: e.target.value }))}
                disabled={!codeCreateMode}
              />
            </div>
            <div className="space-y-1">
              <Label>{T.detailCodeName}</Label>
              <Input value={codeForm.name} onChange={(e) => setCodeForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{T.sortOrder}</Label>
              <Input
                type="number"
                value={codeForm.sort_order}
                onChange={(e) => setCodeForm((p) => ({ ...p, sort_order: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{T.engName}</Label>
              <Input
                value={codeForm.extra_value1}
                onChange={(e) => setCodeForm((p) => ({ ...p, extra_value1: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{T.note1}</Label>
              <Input
                value={codeForm.extra_value2}
                onChange={(e) => setCodeForm((p) => ({ ...p, extra_value2: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{T.note2}</Label>
              <Input
                value={codeForm.description}
                onChange={(e) => setCodeForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={codeForm.is_active}
              onCheckedChange={(value) => setCodeForm((p) => ({ ...p, is_active: Boolean(value) }))}
            />
            {T.use}
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
