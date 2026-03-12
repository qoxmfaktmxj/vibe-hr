"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
  MenuAdminItem,
  RoleItem,
  RoleMenuActionPermissionMatrixResponse,
  RoleMenuPermissionMatrixResponse,
} from "@/types/menu-admin";

type FlatMenu = {
  id: number;
  code: string;
  name: string;
  depth: number;
  parentId: number | null;
  path: string | null;
};

const ACTIONS = [
  { code: "query", label: "조회" },
  { code: "create", label: "입력" },
  { code: "copy", label: "복사" },
  { code: "template_download", label: "템플릿" },
  { code: "upload", label: "업로드" },
  { code: "save", label: "저장" },
  { code: "download", label: "다운로드" },
] as const;

function flattenMenus(nodes: MenuAdminItem[], depth = 0, parentId: number | null = null): FlatMenu[] {
  return nodes.flatMap((node) => [
    { id: node.id, code: node.code, name: node.name, depth, parentId, path: node.path },
    ...flattenMenus(node.children, depth + 1, node.id),
  ]);
}

function actionKey(roleId: number, menuId: number, actionCode: string): string {
  return `${roleId}:${menuId}:${actionCode}`;
}

export function PermissionMatrixManager() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [menus, setMenus] = useState<MenuAdminItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [menuMatrix, setMenuMatrix] = useState<Record<number, Set<number>>>({});
  const [actionMatrix, setActionMatrix] = useState<Record<string, boolean>>({});
  const [applyToChildren, setApplyToChildren] = useState(true);
  const [savingMenu, setSavingMenu] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const flatMenus = useMemo(() => flattenMenus(menus), [menus]);
  const actionMenus = useMemo(() => flatMenus.filter((menu) => Boolean(menu.path)), [flatMenus]);
  const visibleMenus = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatMenus;
    return flatMenus.filter((menu) => menu.name.toLowerCase().includes(q) || menu.code.toLowerCase().includes(q));
  }, [flatMenus, search]);
  const visibleActionMenus = useMemo(() => {
    const visibleIds = new Set(visibleMenus.map((menu) => menu.id));
    return actionMenus.filter((menu) => visibleIds.has(menu.id));
  }, [actionMenus, visibleMenus]);

  const descendantsMap = useMemo(() => {
    const map: Record<number, number[]> = {};

    const walk = (nodes: MenuAdminItem[]): number[] => {
      const all: number[] = [];
      for (const node of nodes) {
        const childIds = walk(node.children);
        map[node.id] = childIds;
        all.push(node.id, ...childIds);
      }
      return all;
    };

    walk(menus);
    return map;
  }, [menus]);

  async function loadBase() {
    setLoading(true);
    const [rolesRes, menusRes, menuPermissionsRes, actionPermissionsRes] = await Promise.all([
      fetch("/api/menus/admin/roles", { cache: "no-store" }),
      fetch("/api/menus/admin/tree", { cache: "no-store" }),
      fetch("/api/menus/admin/roles/permissions", { cache: "no-store" }),
      fetch("/api/menus/admin/roles/action-permissions", { cache: "no-store" }),
    ]);

    if (!rolesRes.ok) throw new Error("역할 목록을 불러오지 못했습니다.");
    if (!menusRes.ok) throw new Error("메뉴 목록을 불러오지 못했습니다.");
    if (!menuPermissionsRes.ok) throw new Error("메뉴 권한 매트릭스를 불러오지 못했습니다.");
    if (!actionPermissionsRes.ok) throw new Error("액션 권한 매트릭스를 불러오지 못했습니다.");

    const rolesJson = (await rolesRes.json()) as { roles: RoleItem[] };
    const menusJson = (await menusRes.json()) as { menus: MenuAdminItem[] };
    const menuPermissionsJson = (await menuPermissionsRes.json()) as RoleMenuPermissionMatrixResponse;
    const actionPermissionsJson = (await actionPermissionsRes.json()) as RoleMenuActionPermissionMatrixResponse;

    setRoles(rolesJson.roles);
    setMenus(menusJson.menus);
    setSelectedRoleIds((prev) => (prev.length > 0 ? prev : rolesJson.roles.map((role) => role.id)));

    const nextMenuMatrix: Record<number, Set<number>> = {};
    const menuMappingByRoleId = new Map(
      menuPermissionsJson.mappings.map((mapping) => [mapping.role_id, mapping.menu_ids]),
    );
    for (const role of rolesJson.roles) {
      nextMenuMatrix[role.id] = new Set(menuMappingByRoleId.get(role.id) ?? []);
    }
    setMenuMatrix(nextMenuMatrix);

    const nextActionMatrix: Record<string, boolean> = {};
    for (const mapping of actionPermissionsJson.mappings) {
      nextActionMatrix[actionKey(mapping.role_id, mapping.menu_id, mapping.action_code)] = mapping.allowed;
    }
    setActionMatrix(nextActionMatrix);
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadBase();
      } catch (error) {
        setNoticeType("error");
        setNotice(error instanceof Error ? error.message : "권한 화면 초기 로딩에 실패했습니다.");
        setLoading(false);
      }
    })();
  }, []);

  function toggleRole(roleId: number) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  }

  function toggleMenuCell(roleId: number, menuId: number, checked: boolean) {
    setMenuMatrix((prev) => {
      const next = { ...prev };
      const roleMenuSet = new Set(next[roleId] ?? []);
      const targets = applyToChildren ? [menuId, ...(descendantsMap[menuId] ?? [])] : [menuId];

      if (checked) {
        for (const id of targets) roleMenuSet.add(id);
      } else {
        for (const id of targets) roleMenuSet.delete(id);
      }

      next[roleId] = roleMenuSet;
      return next;
    });
  }

  function getMenuCellState(roleId: number, menuId: number): boolean | "indeterminate" {
    const roleMenuSet = menuMatrix[roleId] ?? new Set<number>();
    const selfChecked = roleMenuSet.has(menuId);
    const descendants = descendantsMap[menuId] ?? [];

    if (descendants.length === 0) {
      return selfChecked;
    }

    const checkedChildren = descendants.filter((id) => roleMenuSet.has(id)).length;
    if (checkedChildren === 0) {
      return selfChecked;
    }
    if (selfChecked && checkedChildren === descendants.length) {
      return true;
    }
    return "indeterminate";
  }

  function getActionAllowed(roleId: number, menuId: number, actionCode: string): boolean {
    return actionMatrix[actionKey(roleId, menuId, actionCode)] ?? true;
  }

  function toggleAction(roleId: number, menuId: number, actionCode: string, checked: boolean) {
    setActionMatrix((prev) => ({
      ...prev,
      [actionKey(roleId, menuId, actionCode)]: checked,
    }));
  }

  async function saveMenuPermissions() {
    setSavingMenu(true);
    setNotice(null);
    try {
      const res = await fetch("/api/menus/admin/roles/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: selectedRoleIds.map((roleId) => ({
            role_id: roleId,
            menu_ids: Array.from(menuMatrix[roleId] ?? []),
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | RoleMenuPermissionMatrixResponse
        | { detail?: string }
        | null;
      if (!res.ok) {
        throw new Error((data as { detail?: string } | null)?.detail ?? "메뉴 권한 저장에 실패했습니다.");
      }

      if (data && "mappings" in data) {
        const nextMenuMatrix: Record<number, Set<number>> = {};
        for (const role of roles) {
          const found = data.mappings.find((mapping) => mapping.role_id === role.id);
          nextMenuMatrix[role.id] = new Set(found?.menu_ids ?? []);
        }
        setMenuMatrix(nextMenuMatrix);
      }

      setNoticeType("success");
      setNotice("메뉴 권한 저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "메뉴 권한 저장에 실패했습니다.");
    } finally {
      setSavingMenu(false);
    }
  }

  async function saveActionPermissions() {
    setSavingAction(true);
    setNotice(null);
    try {
      const res = await fetch("/api/menus/admin/roles/action-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: selectedRoleIds.flatMap((roleId) =>
            actionMenus.flatMap((menu) =>
              ACTIONS.map((action) => ({
                role_id: roleId,
                menu_id: menu.id,
                action_code: action.code,
                allowed: getActionAllowed(roleId, menu.id, action.code),
              })),
            ),
          ),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | RoleMenuActionPermissionMatrixResponse
        | { detail?: string }
        | null;
      if (!res.ok) {
        throw new Error((data as { detail?: string } | null)?.detail ?? "액션 권한 저장에 실패했습니다.");
      }

      const nextActionMatrix: Record<string, boolean> = {};
      if (data && "mappings" in data) {
        for (const mapping of data.mappings) {
          nextActionMatrix[actionKey(mapping.role_id, mapping.menu_id, mapping.action_code)] = mapping.allowed;
        }
      }
      setActionMatrix(nextActionMatrix);
      setNoticeType("success");
      setNotice("액션 권한 저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "액션 권한 저장에 실패했습니다.");
    } finally {
      setSavingAction(false);
    }
  }

  if (loading) {
    return <div className="p-6">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>권한 대상 선택</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="메뉴명 또는 코드 검색"
              className="max-w-sm"
            />
            <label className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <Checkbox checked={applyToChildren} onCheckedChange={(value) => setApplyToChildren(Boolean(value))} />
              하위 메뉴까지 함께 반영
            </label>
          </div>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">표시할 역할</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const checked = selectedRoleIds.includes(role.id);
                return (
                  <label key={role.id} className="flex items-center gap-2 rounded border bg-white px-3 py-1.5 text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggleRole(role.id)} />
                    {role.name} ({role.code})
                  </label>
                );
              })}
            </div>
          </div>
          {notice ? (
            <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>메뉴 권한 매트릭스</CardTitle>
          <Button variant="save" onClick={saveMenuPermissions} disabled={savingMenu || selectedRoleIds.length === 0}>
            {savingMenu ? "저장 중..." : "메뉴 권한 저장"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border px-2 py-2 text-left">메뉴</th>
                  {roles
                    .filter((role) => selectedRoleIds.includes(role.id))
                    .map((role) => (
                      <th key={role.id} className="border px-2 py-2 text-center">
                        {role.name}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {visibleMenus.map((menu) => (
                  <tr key={menu.id} className="odd:bg-white even:bg-slate-50">
                    <td className="border px-2 py-2">
                      <span style={{ paddingLeft: `${menu.depth * 14}px` }}>
                        {menu.depth > 0 ? "- " : ""}
                        {menu.name} ({menu.code})
                      </span>
                    </td>
                    {roles
                      .filter((role) => selectedRoleIds.includes(role.id))
                      .map((role) => {
                        const state = getMenuCellState(role.id, menu.id);
                        return (
                          <td key={`${menu.id}-${role.id}`} className="border px-2 py-2 text-center">
                            <Checkbox
                              checked={state}
                              onCheckedChange={(value) => toggleMenuCell(role.id, menu.id, value === true)}
                            />
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>화면 액션 권한 매트릭스</CardTitle>
          <Button
            variant="save"
            onClick={saveActionPermissions}
            disabled={savingAction || selectedRoleIds.length === 0}
          >
            {savingAction ? "저장 중..." : "액션 권한 저장"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1200px] border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border px-2 py-2 text-left">화면</th>
                  {roles
                    .filter((role) => selectedRoleIds.includes(role.id))
                    .map((role) => (
                      <th key={role.id} className="border px-2 py-2 text-center">
                        {role.name}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {visibleActionMenus.map((menu) => (
                  <tr key={menu.id} className="align-top odd:bg-white even:bg-slate-50">
                    <td className="border px-2 py-2">
                      <div className="font-medium">
                        {menu.name} ({menu.code})
                      </div>
                      <div className="text-xs text-slate-500">{menu.path}</div>
                    </td>
                    {roles
                      .filter((role) => selectedRoleIds.includes(role.id))
                      .map((role) => (
                        <td key={`${menu.id}-${role.id}`} className="border px-2 py-2">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            {ACTIONS.map((action) => (
                              <label key={`${role.id}-${menu.id}-${action.code}`} className="flex items-center gap-2 text-xs">
                                <Checkbox
                                  checked={getActionAllowed(role.id, menu.id, action.code)}
                                  onCheckedChange={(value) =>
                                    toggleAction(role.id, menu.id, action.code, value === true)
                                  }
                                />
                                {action.label}
                              </label>
                            ))}
                          </div>
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
