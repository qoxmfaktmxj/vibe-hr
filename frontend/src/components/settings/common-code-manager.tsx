"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { type ColDef, type GridApi } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GridStandardToolbar } from "@/components/grid/grid-standard-toolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetcher } from "@/lib/fetcher";
import type {
  CodeDetailResponse,
  CodeGroupDetailResponse,
  CodeGroupItem,
  CodeGroupListResponse,
  CodeItem,
  CodeListResponse,
} from "@/types/common-code";

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
  askDeleteGroup: "선택한 그룹코드를 삭제하시겠습니까? 하위 세부코드도 함께 삭제됩니다.",
  askDeleteCode: "선택한 세부코드를 삭제하시겠습니까?",
  copySuffix: " 복사",
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

type DeleteTarget =
  | { kind: "group"; groupId: number }
  | { kind: "code"; groupId: number; codeId: number }
  | null;

export function CommonCodeManager() {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<number | null>(null);

  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
  const [codeForm, setCodeForm] = useState(EMPTY_CODE);

  const [groupCreateMode, setGroupCreateMode] = useState(false);
  const [codeCreateMode, setCodeCreateMode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [groupCodeQuery, setGroupCodeQuery] = useState("");
  const [groupNameQuery, setGroupNameQuery] = useState("");
  const [detailCodeQuery, setDetailCodeQuery] = useState("");
  const [detailNameQuery, setDetailNameQuery] = useState("");

  const groupCodeQueryD = useDeferredValue(groupCodeQuery);
  const groupNameQueryD = useDeferredValue(groupNameQuery);
  const detailCodeQueryD = useDeferredValue(detailCodeQuery);
  const detailNameQueryD = useDeferredValue(detailNameQuery);

  const groupGridApiRef = useRef<GridApi<CodeGroupItem> | null>(null);
  const codeGridApiRef = useRef<GridApi<CodeItem> | null>(null);

  const {
    data: groupData,
    error: groupError,
    isLoading: groupLoading,
    mutate: mutateGroups,
  } = useSWR<CodeGroupListResponse>("/api/codes/groups", fetcher, {
    revalidateOnFocus: false,
  });

  const groups = groupData?.groups ?? [];

  const {
    data: codeData,
    error: codeError,
    isLoading: codeLoading,
    mutate: mutateCodes,
  } = useSWR<CodeListResponse>(
    selectedGroupId ? `/api/codes/groups/${selectedGroupId}/items` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const codes = codeData?.codes ?? [];

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const selectedCode = useMemo(
    () => codes.find((code) => code.id === selectedCodeId) ?? null,
    [codes, selectedCodeId],
  );

  const filteredGroups = useMemo(() => {
    const codeQuery = groupCodeQueryD.trim().toLowerCase();
    const nameQuery = groupNameQueryD.trim().toLowerCase();
    return groups.filter((group) => {
      const byCode = !codeQuery || group.code.toLowerCase().includes(codeQuery);
      const byName = !nameQuery || group.name.toLowerCase().includes(nameQuery);
      return byCode && byName;
    });
  }, [groupCodeQueryD, groupNameQueryD, groups]);

  const filteredCodes = useMemo(() => {
    const codeQuery = detailCodeQueryD.trim().toLowerCase();
    const nameQuery = detailNameQueryD.trim().toLowerCase();
    return codes.filter((code) => {
      const byCode = !codeQuery || code.code.toLowerCase().includes(codeQuery);
      const byName = !nameQuery || code.name.toLowerCase().includes(nameQuery);
      return byCode && byName;
    });
  }, [codes, detailCodeQueryD, detailNameQueryD]);

  const groupColumns: ColDef<CodeGroupItem>[] = [
    { field: "code", headerName: "그룹코드", flex: 1, minWidth: 140 },
    { field: "name", headerName: "그룹코드명", flex: 1.2, minWidth: 180 },
    { field: "description", headerName: "설명", flex: 1.4, minWidth: 200 },
    { field: "is_active", headerName: "사용", width: 90, valueFormatter: (p) => (p.value ? "Y" : "N") },
    { field: "sort_order", headerName: "정렬", width: 90 },
  ];

  const codeColumns: ColDef<CodeItem>[] = [
    { field: "code", headerName: "세부코드", flex: 1, minWidth: 140 },
    { field: "name", headerName: "세부코드명", flex: 1.2, minWidth: 180 },
    { field: "description", headerName: "설명", flex: 1.2, minWidth: 180 },
    { field: "extra_value1", headerName: "영문명", flex: 1, minWidth: 140 },
    { field: "extra_value2", headerName: "비고1", flex: 1, minWidth: 140 },
    { field: "sort_order", headerName: "정렬", width: 90 },
    { field: "is_active", headerName: "사용", width: 90, valueFormatter: (p) => (p.value ? "Y" : "N") },
  ];

  useEffect(() => {
    if (groupCreateMode) return;
    if (!selectedGroupId) {
      setSelectedGroupId(groups[0]?.id ?? null);
      return;
    }
    if (!groups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(groups[0]?.id ?? null);
    }
  }, [groups, selectedGroupId, groupCreateMode]);

  useEffect(() => {
    if (codeCreateMode) return;
    if (!selectedCodeId) {
      setSelectedCodeId(codes[0]?.id ?? null);
      return;
    }
    if (!codes.some((c) => c.id === selectedCodeId)) {
      setSelectedCodeId(codes[0]?.id ?? null);
    }
  }, [codes, selectedCodeId, codeCreateMode]);

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

      await mutateGroups();
      if (data && "group" in data) setSelectedGroupId(data.group.id);
      setGroupCreateMode(false);
      toast.success(T.groupSaved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : T.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function doDeleteGroup(groupId: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/codes/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? T.deleteFailed);
      }
      await mutateGroups();
      setSelectedGroupId(null);
      setSelectedCodeId(null);
      toast.success(T.groupDeleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : T.deleteFailed);
    } finally {
      setSaving(false);
    }
  }

  async function saveCode() {
    if (!selectedGroupId) return;
    setSaving(true);
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

      await mutateCodes();
      if (data && "code" in data) setSelectedCodeId(data.code.id);
      setCodeCreateMode(false);
      toast.success(T.codeSaved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : T.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function doDeleteCode(groupId: number, codeId: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/codes/groups/${groupId}/items/${codeId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? T.deleteFailed);
      }
      await mutateCodes();
      setSelectedCodeId(null);
      toast.success(T.codeDeleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : T.deleteFailed);
    } finally {
      setSaving(false);
    }
  }

  const handleTemplateDownload = () => {
    toast.success("양식다운로드는 다음 단계에서 화면별 xlsx 템플릿으로 연결합니다.");
  };

  const handleUpload = () => {
    toast.success("업로드는 다음 단계에서 표준 템플릿 매핑으로 연결합니다.");
  };

  if (groupLoading) return <div className="p-6">{T.loading}</div>;
  if (groupError) return <div className="p-6 text-red-500">{T.initLoadError}: {String(groupError)}</div>;

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
            <Input placeholder="그룹코드" value={groupCodeQuery} onChange={(e) => setGroupCodeQuery(e.target.value)} />
            <Input placeholder="그룹코드명" value={groupNameQuery} onChange={(e) => setGroupNameQuery(e.target.value)} />
          </div>
          <GridStandardToolbar
            onQuery={() => void mutateGroups()}
            onCreate={() => {
              setGroupCreateMode(true);
              setSelectedGroupId(null);
            }}
            onCopy={copyGroup}
            onTemplateDownload={handleTemplateDownload}
            onUpload={handleUpload}
            onSave={saveGroup}
            onDownload={() => groupGridApiRef.current?.exportDataAsCsv({ fileName: "group-codes.csv" })}
            disabled={{ copy: !selectedGroup, save: saving }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>그룹코드 관리</CardTitle>
          <div className="text-xs text-slate-500">표준 툴바는 상단 공통 버튼을 사용합니다.</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="ag-theme-quartz" style={{ height: 300 }}>
            <AgGridReact<CodeGroupItem>
              theme="legacy"
              rowData={filteredGroups}
              columnDefs={groupColumns}
              getRowId={(p) => String(p.data.id)}
              rowSelection={{ mode: "singleRow", checkboxes: false }}
              onGridReady={(event) => {
                groupGridApiRef.current = event.api;
              }}
              onRowClicked={(event) => {
                if (!event.data) return;
                setGroupCreateMode(false);
                setSelectedGroupId(event.data.id);
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="space-y-1"><Label>그룹코드</Label><Input value={groupForm.code} onChange={(e) => setGroupForm((p) => ({ ...p, code: e.target.value }))} disabled={!groupCreateMode} /></div>
            <div className="space-y-1"><Label>그룹코드명</Label><Input value={groupForm.name} onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>설명</Label><Input value={groupForm.description} onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-1"><Label>정렬순서</Label><Input type="number" value={groupForm.sort_order} onChange={(e) => setGroupForm((p) => ({ ...p, sort_order: e.target.value }))} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={groupForm.is_active} onCheckedChange={(v) => setGroupForm((p) => ({ ...p, is_active: Boolean(v) }))} />사용
          </label>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => selectedGroupId && setDeleteTarget({ kind: "group", groupId: selectedGroupId })}
            disabled={saving || !selectedGroupId || groupCreateMode}
          >
            그룹 삭제
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <Input placeholder="세부코드" value={detailCodeQuery} onChange={(e) => setDetailCodeQuery(e.target.value)} />
            <Input placeholder="세부코드명" value={detailNameQuery} onChange={(e) => setDetailNameQuery(e.target.value)} />
            <Button variant="query" type="button" onClick={() => void mutateCodes()} disabled={!selectedGroupId || codeLoading}>
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>세부코드 관리 {selectedGroup ? `(${selectedGroup.name})` : ""}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => codeGridApiRef.current?.exportDataAsCsv({ fileName: "detail-codes.csv" })} disabled={!selectedGroupId}>엑셀 다운로드</Button>
            <Button size="sm" variant="outline" onClick={copyCode} disabled={!selectedCode}>복사</Button>
            <Button size="sm" variant="outline" onClick={() => { setCodeCreateMode(true); setSelectedCodeId(null); }} disabled={!selectedGroupId}>입력</Button>
            <Button size="sm" variant="save" onClick={saveCode} disabled={saving || !selectedGroupId}>저장</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => selectedGroupId && selectedCodeId && setDeleteTarget({ kind: "code", groupId: selectedGroupId, codeId: selectedCodeId })}
              disabled={saving || !selectedCodeId || codeCreateMode}
            >
              삭제
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {codeError ? <div className="text-sm text-red-500">{String(codeError)}</div> : null}
          <div className="ag-theme-quartz" style={{ height: 320 }}>
            <AgGridReact<CodeItem>
              theme="legacy"
              rowData={filteredCodes}
              columnDefs={codeColumns}
              getRowId={(p) => String(p.data.id)}
              rowSelection={{ mode: "singleRow", checkboxes: false }}
              onGridReady={(event) => {
                codeGridApiRef.current = event.api;
              }}
              onRowClicked={(event) => {
                if (!event.data) return;
                setCodeCreateMode(false);
                setSelectedCodeId(event.data.id);
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="space-y-1"><Label>세부코드</Label><Input value={codeForm.code} onChange={(e) => setCodeForm((p) => ({ ...p, code: e.target.value }))} disabled={!codeCreateMode} /></div>
            <div className="space-y-1"><Label>세부코드명</Label><Input value={codeForm.name} onChange={(e) => setCodeForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>정렬순서</Label><Input type="number" value={codeForm.sort_order} onChange={(e) => setCodeForm((p) => ({ ...p, sort_order: e.target.value }))} /></div>
            <div className="space-y-1"><Label>영문명</Label><Input value={codeForm.extra_value1} onChange={(e) => setCodeForm((p) => ({ ...p, extra_value1: e.target.value }))} /></div>
            <div className="space-y-1"><Label>비고1</Label><Input value={codeForm.extra_value2} onChange={(e) => setCodeForm((p) => ({ ...p, extra_value2: e.target.value }))} /></div>
            <div className="space-y-1"><Label>비고2</Label><Input value={codeForm.description} onChange={(e) => setCodeForm((p) => ({ ...p, description: e.target.value }))} /></div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={codeForm.is_active} onCheckedChange={(v) => setCodeForm((p) => ({ ...p, is_active: Boolean(v) }))} />사용
          </label>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="삭제 확인"
        description={deleteTarget?.kind === "group" ? T.askDeleteGroup : T.askDeleteCode}
        confirmLabel="삭제"
        confirmVariant="destructive"
        busy={saving}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "group") {
            await doDeleteGroup(deleteTarget.groupId);
          } else {
            await doDeleteCode(deleteTarget.groupId, deleteTarget.codeId);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
