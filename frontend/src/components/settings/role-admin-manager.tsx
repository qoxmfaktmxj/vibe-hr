"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RoleItem } from "@/types/menu-admin";

export function RoleAdminManager() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  async function loadRoles() {
    setError(null);
    const rolesRes = await fetch("/api/menus/admin/roles", { cache: "no-store" });
    if (!rolesRes.ok) throw new Error("역할 목록을 불러오지 못했습니다.");

    const rolesJson = (await rolesRes.json()) as { roles: RoleItem[] };
    setRoles(rolesJson.roles);
    setSelectedRoleId((prev) => prev ?? rolesJson.roles[0]?.id ?? null);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadRoles();
      } catch (e) {
        setError(e instanceof Error ? e.message : "초기화 실패");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      setCode("");
      setName("");
      return;
    }

    setName(selectedRole?.name ?? "");
    setCode(selectedRole?.code ?? "");
  }, [selectedRoleId, selectedRole]);

  function startCreateMode() {
    setSelectedRoleId(null);
    setCode("");
    setName("");
    setError(null);
    setNotice(null);
    setNoticeType(null);
  }

  async function saveRole() {
    setSaving(true);
    setError(null);
    try {
      if (selectedRoleId) {
        const res = await fetch(`/api/menus/admin/roles/${selectedRoleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail ?? "역할 저장 실패");
        await loadRoles();
        setSelectedRoleId(selectedRoleId);
      } else {
        const res = await fetch("/api/menus/admin/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, name }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail ?? "역할 저장 실패");

        await loadRoles();
        if (data?.role?.id) setSelectedRoleId(data.role.id);
      }
      setNoticeType("success");
      setNotice("저장이 완료되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "역할 저장 실패");
      setNoticeType("error");
      setNotice("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole() {
    if (!selectedRoleId) return;
    if (!confirm("선택한 역할을 삭제할까요?")) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/menus/admin/roles/${selectedRoleId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? "역할 삭제 실패");
      }

      setSelectedRoleId(null);
      await loadRoles();
      setNoticeType("success");
      setNotice("삭제가 완료되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "역할 삭제 실패");
      setNoticeType("error");
      setNotice("삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>권한 목록</CardTitle>
          <Button size="sm" variant="outline" onClick={startCreateMode}>
            새 권한
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                setError(null);
                setNotice(null);
                setNoticeType(null);
                setSelectedRoleId(role.id);
              }}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                selectedRoleId === role.id ? "bg-primary/10 text-primary" : "hover:bg-gray-100"
              }`}
            >
              <span className="font-medium">{role.name}</span>
              <span className="ml-2 text-xs text-gray-500">({role.code})</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>권한 상세</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {notice ? (
            <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>
              {notice}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-500">상세: {error}</p> : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>권한 코드</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: reviewer"
                disabled={Boolean(selectedRoleId)}
              />
            </div>
            <div className="space-y-2">
              <Label>권한 이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 검토자" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveRole} disabled={saving || !name || (!selectedRoleId && !code)}>
              저장
            </Button>
            <Button onClick={deleteRole} variant="destructive" disabled={saving || !selectedRoleId}>
              권한 삭제
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
