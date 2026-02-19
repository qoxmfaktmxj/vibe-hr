"use client";

import { useEffect, useMemo, useState } from "react";

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

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );
  const selectedCode = useMemo(
    () => codes.find((code) => code.id === selectedCodeId) ?? null,
    [codes, selectedCodeId],
  );

  async function loadGroups() {
    const res = await fetch("/api/codes/groups", { cache: "no-store" });
    if (!res.ok) throw new Error("코드 그룹을 불러오지 못했습니다.");
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
        setNotice(error instanceof Error ? error.message : "초기 로딩 실패");
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

      const data = (await res.json().catch(() => null)) as
        | CodeGroupDetailResponse
        | { detail?: string }
        | null;
      if (!res.ok) throw new Error((data as { detail?: string } | null)?.detail ?? "저장 실패");

      await loadGroups();
      if (data && "group" in data) setSelectedGroupId(data.group.id);
      setGroupCreateMode(false);
      setNoticeType("success");
      setNotice("저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!selectedGroupId || groupCreateMode) return;
    if (!confirm("선택한 코드 그룹을 삭제할까요? 하위 코드도 함께 삭제됩니다.")) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/codes/groups/${selectedGroupId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "삭제 실패");
      }
      await loadGroups();
      setSelectedGroupId(null);
      setCodes([]);
      setNoticeType("success");
      setNotice("삭제가 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "삭제에 실패했습니다.");
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
      if (!res.ok) throw new Error((data as { detail?: string } | null)?.detail ?? "저장 실패");

      await loadCodes(selectedGroupId);
      if (data && "code" in data) setSelectedCodeId(data.code.id);
      setCodeCreateMode(false);
      setNoticeType("success");
      setNotice("저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCode() {
    if (!selectedGroupId || !selectedCodeId || codeCreateMode) return;
    if (!confirm("선택한 코드를 삭제할까요?")) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/codes/groups/${selectedGroupId}/items/${selectedCodeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "삭제 실패");
      }
      await loadCodes(selectedGroupId);
      setSelectedCodeId(null);
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>공통코드 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice ? (
            <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>
              {notice}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="xl:col-span-2 space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">코드 그룹</h3>
                <Button size="sm" variant="outline" onClick={() => { setGroupCreateMode(true); setSelectedGroupId(null); }}>
                  입력
                </Button>
              </div>
              <div className="max-h-[420px] overflow-auto rounded-md border">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`block w-full border-b px-3 py-2 text-left text-sm ${
                      !groupCreateMode && selectedGroupId === group.id ? "bg-primary/10 text-primary" : "hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setGroupCreateMode(false);
                      setSelectedGroupId(group.id);
                      setNotice(null);
                    }}
                  >
                    <span className="font-medium">{group.name}</span>
                    <span className="ml-2 text-xs text-slate-500">({group.code})</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Label>그룹 코드</Label>
                <Input value={groupForm.code} onChange={(e) => setGroupForm((p) => ({ ...p, code: e.target.value }))} disabled={!groupCreateMode} />
                <Label>그룹명</Label>
                <Input value={groupForm.name} onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))} />
                <Label>설명</Label>
                <Input value={groupForm.description} onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))} />
                <Label>정렬</Label>
                <Input type="number" value={groupForm.sort_order} onChange={(e) => setGroupForm((p) => ({ ...p, sort_order: e.target.value }))} />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={groupForm.is_active} onCheckedChange={(v) => setGroupForm((p) => ({ ...p, is_active: Boolean(v) }))} />
                  사용
                </label>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveGroup} disabled={saving}>저장</Button>
                <Button variant="destructive" onClick={deleteGroup} disabled={saving || !selectedGroupId || groupCreateMode}>삭제</Button>
              </div>
            </div>

            <div className="xl:col-span-3 space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">코드 상세 {selectedGroup ? `(${selectedGroup.name})` : ""}</h3>
                <Button size="sm" variant="outline" onClick={() => { setCodeCreateMode(true); setSelectedCodeId(null); }} disabled={!selectedGroupId}>
                  입력
                </Button>
              </div>
              <div className="max-h-[300px] overflow-auto rounded-md border">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="border px-2 py-2 text-left">코드</th>
                      <th className="border px-2 py-2 text-left">코드명</th>
                      <th className="border px-2 py-2 text-center">정렬</th>
                      <th className="border px-2 py-2 text-center">사용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((code) => (
                      <tr
                        key={code.id}
                        className={`cursor-pointer ${
                          !codeCreateMode && selectedCodeId === code.id ? "bg-primary/10" : "odd:bg-white even:bg-slate-50"
                        }`}
                        onClick={() => {
                          setCodeCreateMode(false);
                          setSelectedCodeId(code.id);
                        }}
                      >
                        <td className="border px-2 py-2">{code.code}</td>
                        <td className="border px-2 py-2">{code.name}</td>
                        <td className="border px-2 py-2 text-center">{code.sort_order}</td>
                        <td className="border px-2 py-2 text-center">{code.is_active ? "Y" : "N"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>코드</Label>
                  <Input value={codeForm.code} onChange={(e) => setCodeForm((p) => ({ ...p, code: e.target.value }))} disabled={!codeCreateMode} />
                </div>
                <div className="space-y-1">
                  <Label>코드명</Label>
                  <Input value={codeForm.name} onChange={(e) => setCodeForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>정렬</Label>
                  <Input type="number" value={codeForm.sort_order} onChange={(e) => setCodeForm((p) => ({ ...p, sort_order: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>설명</Label>
                  <Input value={codeForm.description} onChange={(e) => setCodeForm((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>extra_value1</Label>
                  <Input value={codeForm.extra_value1} onChange={(e) => setCodeForm((p) => ({ ...p, extra_value1: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>extra_value2</Label>
                  <Input value={codeForm.extra_value2} onChange={(e) => setCodeForm((p) => ({ ...p, extra_value2: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={codeForm.is_active} onCheckedChange={(v) => setCodeForm((p) => ({ ...p, is_active: Boolean(v) }))} />
                사용
              </label>
              <div className="flex gap-2">
                <Button onClick={saveCode} disabled={saving || !selectedGroupId}>저장</Button>
                <Button variant="destructive" onClick={deleteCode} disabled={saving || !selectedCodeId || codeCreateMode}>삭제</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
