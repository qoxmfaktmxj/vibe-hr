"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuAdminItem, RoleItem } from "@/types/menu-admin";

type FlatMenu = {
  id: number;
  label: string;
};

function flattenMenus(nodes: MenuAdminItem[], depth = 0): FlatMenu[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"-".repeat(depth)} ${node.name} (${node.code})` },
    ...flattenMenus(node.children, depth + 1),
  ]);
}

function collectMenuIds(nodes: MenuAdminItem[]): number[] {
  const ids: number[] = [];
  const walk = (items: MenuAdminItem[]) => {
    for (const item of items) {
      ids.push(item.id);
      if (item.children.length > 0) walk(item.children);
    }
  };
  walk(nodes);
  return ids;
}

export function RoleAdminManager() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [menus, setMenus] = useState<MenuAdminItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatMenus = useMemo(() => flattenMenus(menus), [menus]);
  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  async function loadBase() {
    setError(null);
    const [rolesRes, menusRes] = await Promise.all([
      fetch("/api/menus/admin/roles", { cache: "no-store" }),
      fetch("/api/menus/admin/tree", { cache: "no-store" }),
    ]);

    if (!rolesRes.ok) throw new Error("역할 목록을 불러오지 못했습니다.");
    if (!menusRes.ok) throw new Error("메뉴 목록을 불러오지 못했습니다.");

    const rolesJson = (await rolesRes.json()) as { roles: RoleItem[] };
    const menusJson = (await menusRes.json()) as { menus: MenuAdminItem[] };

    setRoles(rolesJson.roles);
    setMenus(menusJson.menus);
    setSelectedRoleId((prev) => prev ?? rolesJson.roles[0]?.id ?? null);
  }

  async function loadRoleMenus(roleId: number) {
    const res = await fetch(`/api/menus/admin/roles/${roleId}/menus`, { cache: "no-store" });
    if (!res.ok) {
      setSelectedMenuIds([]);
      return;
    }

    const data = (await res.json()) as { role_id: number; menus: MenuAdminItem[] };
    setSelectedMenuIds(collectMenuIds(data.menus));
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadBase();
      } catch (e) {
        setError(e instanceof Error ? e.message : "초기화 실패");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRoleId) return;
    setName(selectedRole?.name ?? "");
    setCode(selectedRole?.code ?? "");
    void loadRoleMenus(selectedRoleId);
  }, [selectedRoleId, selectedRole]);

  async function createRole() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/menus/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "역할 생성 실패");

      await loadBase();
      if (data?.role?.id) setSelectedRoleId(data.role.id);
      setCode("");
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "역할 생성 실패");
    } finally {
      setSaving(false);
    }
  }

  async function updateRole() {
    if (!selectedRoleId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/menus/admin/roles/${selectedRoleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "역할 저장 실패");
      await loadBase();
      setSelectedRoleId(selectedRoleId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "역할 저장 실패");
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
      setSelectedMenuIds([]);
      await loadBase();
    } catch (e) {
      setError(e instanceof Error ? e.message : "역할 삭제 실패");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoleMenus() {
    if (!selectedRoleId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/menus/admin/roles/${selectedRoleId}/menus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_ids: selectedMenuIds }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "메뉴 권한 저장 실패");
    } catch (e) {
      setError(e instanceof Error ? e.message : "메뉴 권한 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>역할 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRoleId(role.id)}
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
          <CardTitle>권한 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>역할 코드 (신규 생성용)</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: reviewer" />
            </div>
            <div className="space-y-2">
              <Label>역할 이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 검토자" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={createRole} disabled={saving || !code || !name}>
              역할 생성
            </Button>
            <Button onClick={updateRole} variant="secondary" disabled={saving || !selectedRoleId || !name}>
              역할 저장
            </Button>
            <Button onClick={deleteRole} variant="destructive" disabled={saving || !selectedRoleId}>
              역할 삭제
            </Button>
          </div>

          <div className="space-y-2">
            <Label>메뉴 접근 권한 ({selectedRole ? `${selectedRole.name} / ${selectedRole.code}` : "역할 선택 필요"})</Label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {flatMenus.map((menu) => {
                const checked = selectedMenuIds.includes(menu.id);
                return (
                  <label key={menu.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setSelectedMenuIds((prev) =>
                          v ? [...new Set([...prev, menu.id])] : prev.filter((id) => id !== menu.id)
                        );
                      }}
                      disabled={!selectedRoleId}
                    />
                    {menu.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <Button onClick={saveRoleMenus} disabled={saving || !selectedRoleId}>
              메뉴 권한 저장
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
