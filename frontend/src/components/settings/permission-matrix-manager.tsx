"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { ensureAgGridRegistered } from "@/lib/ag-grid";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
  MenuAdminItem,
  RoleItem,
  RoleMenuPermissionMatrixResponse,
} from "@/types/menu-admin";

ensureAgGridRegistered();

type FlatMenu = {
  id: number;
  code: string;
  name: string;
  depth: number;
  parentId: number | null;
};

function flattenMenus(nodes: MenuAdminItem[], depth = 0, parentId: number | null = null): FlatMenu[] {
  return nodes.flatMap((node) => [
    { id: node.id, code: node.code, name: node.name, depth, parentId },
    ...flattenMenus(node.children, depth + 1, node.id),
  ]);
}

export function PermissionMatrixManager() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [menus, setMenus] = useState<MenuAdminItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [matrix, setMatrix] = useState<Record<number, Set<number>>>({});
  const [applyToChildren, setApplyToChildren] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const flatMenus = useMemo(() => flattenMenus(menus), [menus]);
  const visibleMenus = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatMenus;
    return flatMenus.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
  }, [flatMenus, search]);

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

  const visibleRoles = useMemo(
    () => roles.filter((role) => selectedRoleIds.includes(role.id)),
    [roles, selectedRoleIds],
  );

  const getCellState = useCallback(
    (roleId: number, menuId: number): boolean | "indeterminate" => {
      const set = matrix[roleId] ?? new Set<number>();
      const selfChecked = set.has(menuId);
      const descendants = descendantsMap[menuId] ?? [];

      if (descendants.length === 0) {
        return selfChecked;
      }

      const checkedChildren = descendants.filter((id) => set.has(id)).length;
      if (checkedChildren === 0) {
        return selfChecked;
      }

      if (selfChecked && checkedChildren === descendants.length) {
        return true;
      }

      return "indeterminate";
    },
    [descendantsMap, matrix],
  );

  const toggleCell = useCallback(
    (roleId: number, menuId: number, checked: boolean) => {
      setMatrix((prev) => {
        const next = { ...prev };
        const set = new Set(next[roleId] ?? []);
        const targets = applyToChildren ? [menuId, ...(descendantsMap[menuId] ?? [])] : [menuId];

        if (checked) {
          for (const id of targets) set.add(id);
        } else {
          for (const id of targets) set.delete(id);
        }

        next[roleId] = set;
        return next;
      });
    },
    [applyToChildren, descendantsMap],
  );

  const columnDefs = useMemo<ColDef<FlatMenu>[]>(() => {
    const roleColumns: ColDef<FlatMenu>[] = visibleRoles.map((role) => ({
      headerName: role.name,
      colId: `role_${role.id}`,
      width: 120,
      sortable: false,
      filter: false,
      suppressMenu: true,
      cellRenderer: (params: { data: FlatMenu | undefined }) => {
        if (!params.data) return null;
        const menuId = params.data.id;
        const state = getCellState(role.id, menuId);
        return (
          <div className="flex h-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={state}
              onCheckedChange={(value) => toggleCell(role.id, menuId, value === true)}
            />
          </div>
        );
      },
    }));

    return [
      {
        headerName: "메뉴",
        field: "name",
        pinned: "left",
        minWidth: 320,
        flex: 1,
        cellRenderer: (params: { data: FlatMenu | undefined }) => {
          if (!params.data) return null;
          return (
            <span style={{ paddingLeft: `${params.data.depth * 14}px` }}>
              {params.data.depth > 0 ? "- " : ""}
              {params.data.name} ({params.data.code})
            </span>
          );
        },
      },
      ...roleColumns,
    ];
  }, [getCellState, toggleCell, visibleRoles]);

  const defaultColDef = useMemo<ColDef<FlatMenu>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
    }),
    [],
  );

  async function loadBase() {
    setLoading(true);
    const [rolesRes, menusRes, permissionsRes] = await Promise.all([
      fetch("/api/menus/admin/roles", { cache: "no-store" }),
      fetch("/api/menus/admin/tree", { cache: "no-store" }),
      fetch("/api/menus/admin/roles/permissions", { cache: "no-store" }),
    ]);

    if (!rolesRes.ok) throw new Error("권한 목록을 불러오지 못했습니다.");
    if (!menusRes.ok) throw new Error("메뉴 목록을 불러오지 못했습니다.");
    if (!permissionsRes.ok) throw new Error("권한 매트릭스를 불러오지 못했습니다.");

    const rolesJson = (await rolesRes.json()) as { roles: RoleItem[] };
    const menusJson = (await menusRes.json()) as { menus: MenuAdminItem[] };
    const permissionsJson = (await permissionsRes.json()) as RoleMenuPermissionMatrixResponse;

    setRoles(rolesJson.roles);
    setMenus(menusJson.menus);
    setSelectedRoleIds((prev) => (prev.length > 0 ? prev : rolesJson.roles.map((r) => r.id)));

    const mappingByRoleId = new Map(
      permissionsJson.mappings.map((mapping) => [mapping.role_id, mapping.menu_ids]),
    );
    const nextMatrix: Record<number, Set<number>> = {};
    for (const role of rolesJson.roles) {
      nextMatrix[role.id] = new Set(mappingByRoleId.get(role.id) ?? []);
    }
    setMatrix(nextMatrix);
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadBase();
      } catch {
        setNoticeType("error");
        setNotice("초기 로딩에 실패했습니다.");
        setLoading(false);
      }
    })();
  }, []);

  function toggleRole(roleId: number) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  }

  async function saveAll() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/menus/admin/roles/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: selectedRoleIds.map((roleId) => ({
            role_id: roleId,
            menu_ids: Array.from(matrix[roleId] ?? []),
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | RoleMenuPermissionMatrixResponse
        | { detail?: string }
        | null;

      if (!res.ok) {
        throw new Error((data as { detail?: string } | null)?.detail ?? "저장 실패");
      }

      if (data && "mappings" in data) {
        setMatrix((prev) => {
          const next = { ...prev };
          for (const mapping of data.mappings) {
            next[mapping.role_id] = new Set(mapping.menu_ids);
          }
          return next;
        });
      }

      setNoticeType("success");
      setNotice("메뉴 권한 저장이 완료되었습니다.");
    } catch (e) {
      setNoticeType("error");
      setNotice(e instanceof Error ? e.message : "메뉴 권한 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">불러오는 중...</div>;

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>메뉴 권한 매트릭스</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="메뉴명/코드 검색"
              className="max-w-sm"
            />
            <label className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <Checkbox checked={applyToChildren} onCheckedChange={(v) => setApplyToChildren(Boolean(v))} />
              하위 메뉴 일괄 적용
            </label>
            <div className="ml-auto">
              <Button onClick={saveAll} disabled={saving || selectedRoleIds.length === 0}>
                저장
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">권한 표시/편집 대상</p>
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
            <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>
              {notice}
            </p>
          ) : null}

          <div className="ag-theme-alpine h-[68vh] w-full rounded-md border">
            <AgGridReact<FlatMenu>
              rowData={visibleMenus}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={(params) => String(params.data.id)}
              overlayNoRowsTemplate="<span>조회된 메뉴가 없습니다.</span>"
              suppressRowClickSelection={true}
              animateRows={true}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
