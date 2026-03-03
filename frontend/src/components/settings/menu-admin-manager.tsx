"use client";

import * as LucideIcons from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeMenuIconName, MENU_ICON_OPTIONS } from "@/lib/menu-icon-options";
import { renderMenuIcon } from "@/lib/menu-icon-render";
import type { MenuAdminItem, RoleItem } from "@/types/menu-admin";

// 전체 Lucide 아이콘 목록 (고급 검색용)
const LUCIDE_NON_ICON_EXPORTS = new Set(["Icon", "DynamicIcon", "DynamicIconComponent"]);
const ALL_LUCIDE_ICON_NAMES: string[] = Object.keys(LucideIcons)
  .filter((name) => {
    if (LUCIDE_NON_ICON_EXPORTS.has(name)) return false;
    if (!/^[A-Z][A-Za-z0-9]+$/.test(name)) return false;
    const v = (LucideIcons as Record<string, unknown>)[name];
    const t = typeof v;
    return v != null && (t === "function" || t === "object");
  })
  .sort((a, b) => a.localeCompare(b));

type FlatMenu = {
  id: number;
  code: string;
  depth: number;
  name: string;
};

type MenuFormState = {
  code: string;
  name: string;
  parent_id: string;
  path: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
};

const initialForm: MenuFormState = {
  code: "",
  name: "",
  parent_id: "",
  path: "",
  icon: "",
  sort_order: "0",
  is_active: true,
};

function flattenMenus(nodes: MenuAdminItem[], depth = 0): FlatMenu[] {
  return nodes.flatMap((node) => [
    { id: node.id, code: node.code, depth, name: node.name },
    ...flattenMenus(node.children, depth + 1),
  ]);
}

function findMenu(nodes: MenuAdminItem[], id: number): MenuAdminItem | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findMenu(node.children, id);
    if (child) return child;
  }
  return null;
}

function IconPickerGrid({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const source = advanced ? ALL_LUCIDE_ICON_NAMES : (MENU_ICON_OPTIONS as readonly string[]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((name) => name.toLowerCase().includes(q));
  }, [query, source]);

  return (
    <div className="space-y-2">
      {/* 현재 선택된 아이콘 미리보기 + 선택 토글 버튼 */}
      <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-500">
          {renderMenuIcon(value || null, "h-5 w-5")}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
          {value || "(기본 아이콘)"}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
        >
          {open ? "닫기" : "선택"}
        </button>
      </div>

      {/* 아이콘 그리드 피커 */}
      {open && (
        <div className="rounded-md border border-gray-200 bg-white">
          {/* 검색 + 고급 토글 */}
          <div className="flex items-center gap-2 border-b border-gray-100 p-2">
            <Input
              className="h-7 flex-1 text-xs"
              placeholder={advanced ? "전체 아이콘 검색..." : "기본 아이콘 검색..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              onClick={() => { setAdvanced((v) => !v); setQuery(""); }}
              className={`shrink-0 rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                advanced
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {advanced ? "고급 켜짐" : "고급 검색"}
            </button>
            <span className="shrink-0 text-[10px] text-gray-400">{filtered.length}개</span>
          </div>

          {/* 아이콘 그리드 */}
          <div className="max-h-56 overflow-y-auto p-2">
            <div className="grid grid-cols-5 gap-1">
              {/* 없음 옵션 (검색어 없을 때만 표시) */}
              {!query && (
                <button
                  type="button"
                  onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
                  className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 hover:bg-gray-100 ${!value ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}
                  title="없음"
                >
                  <span className="flex h-5 w-5 items-center justify-center text-[11px] text-gray-400">—</span>
                  <span className="w-full truncate text-center text-[10px] text-gray-400">없음</span>
                </button>
              )}
              {filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); setQuery(""); }}
                  className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 hover:bg-gray-100 ${
                    value === name ? "bg-primary/10 text-primary ring-1 ring-primary/40" : "text-gray-600"
                  }`}
                  title={name}
                >
                  {renderMenuIcon(name, "h-5 w-5")}
                  <span className="w-full truncate text-center text-[10px]">{name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-5 py-4 text-center text-xs text-gray-400">
                  검색 결과가 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: MenuAdminItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => {
        const selected = node.id === selectedId;
        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                selected ? "bg-primary/10 text-primary" : "hover:bg-gray-100"
              }`}
            >
              <span className={`shrink-0 ${selected ? "text-primary" : "text-gray-400"}`}>
                {node.icon
                  ? renderMenuIcon(node.icon, "h-4 w-4")
                  : <span className="inline-block h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="font-medium">{node.name}</span>
            </button>
            {node.children.length > 0 ? (
              <div className="ml-4 border-l border-gray-200 pl-2">
                <MenuTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function MenuAdminManager() {
  const [menus, setMenus] = useState<MenuAdminItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [form, setForm] = useState<MenuFormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const flatMenus = useMemo(() => flattenMenus(menus), [menus]);
  const selectedMenu = useMemo(
    () => (selectedMenuId ? findMenu(menus, selectedMenuId) : null),
    [menus, selectedMenuId]
  );

  async function loadBase() {
    setLoading(true);
    setError(null);
    try {
      const [menusRes, rolesRes] = await Promise.all([
        fetch("/api/menus/admin/tree", { cache: "no-store" }),
        fetch("/api/menus/admin/roles", { cache: "no-store" }),
      ]);
      if (!menusRes.ok) throw new Error("메뉴 목록을 불러오지 못했습니다.");
      if (!rolesRes.ok) throw new Error("역할 목록을 불러오지 못했습니다.");

      const menusJson = (await menusRes.json()) as { menus: MenuAdminItem[] };
      const rolesJson = (await rolesRes.json()) as { roles: RoleItem[] };
      setMenus(menusJson.menus);
      setRoles(rolesJson.roles);

      const firstId = menusJson.menus[0]?.id ?? null;
      setSelectedMenuId((prev) => prev ?? firstId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMenuRoles(menuId: number) {
    const res = await fetch(`/api/menus/admin/${menuId}/roles`, { cache: "no-store" });
    if (!res.ok) {
      setSelectedRoleIds([]);
      return;
    }
    const data = (await res.json()) as { menu_id: number; roles: RoleItem[] };
    setSelectedRoleIds(data.roles.map((r) => r.id));
  }

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!selectedMenuId) return;
    void loadMenuRoles(selectedMenuId);
  }, [selectedMenuId]);

  useEffect(() => {
    if (!selectedMenu) return;
    setForm({
      code: selectedMenu.code,
      name: selectedMenu.name,
      parent_id: selectedMenu.parent_id ? String(selectedMenu.parent_id) : "",
      path: selectedMenu.path ?? "",
      icon: normalizeMenuIconName(selectedMenu.icon) ?? "",
      sort_order: String(selectedMenu.sort_order),
      is_active: selectedMenu.is_active,
    });
  }, [selectedMenu]);

  async function saveMenu() {
    if (!selectedMenuId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/menus/admin/${selectedMenuId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          path: form.path || null,
          icon: normalizeMenuIconName(form.icon),
          sort_order: Number(form.sort_order),
          is_active: form.is_active,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "저장 실패");

      await loadBase();
      setSelectedMenuId(selectedMenuId);
      setNoticeType("success");
      setNotice("저장이 완료되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
      setNoticeType("error");
      setNotice("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function createMenu() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/menus/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          path: form.path || null,
          icon: normalizeMenuIconName(form.icon),
          sort_order: Number(form.sort_order),
          is_active: form.is_active,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "생성 실패");

      setShowCreate(false);
      setForm(initialForm);
      await loadBase();
      setNoticeType("success");
      setNotice("생성이 완료되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
      setNoticeType("error");
      setNotice("생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMenu() {
    if (!selectedMenuId) return;
    if (!confirm("정말 삭제할까요? 하위 메뉴가 있으면 삭제되지 않습니다.")) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/menus/admin/${selectedMenuId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? "삭제 실패");
      }
      setSelectedMenuId(null);
      await loadBase();
      setNoticeType("success");
      setNotice("삭제가 완료되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
      setNoticeType("error");
      setNotice("삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoles() {
    if (!selectedMenuId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/menus/admin/${selectedMenuId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_ids: selectedRoleIds }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "권한 저장 실패");
      setNoticeType("success");
      setNotice("접근 권한 저장이 완료되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "권한 저장 실패");
      setNoticeType("error");
      setNotice("접근 권한 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">불러오는 중...</div>;

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>메뉴 트리</CardTitle>
          <Button size="sm" variant="action" onClick={() => { setShowCreate(true); setForm(initialForm); setError(null); setNotice(null); setNoticeType(null); }}>
            새 메뉴
          </Button>
        </CardHeader>
        <CardContent>
          <MenuTree
            nodes={menus}
            selectedId={selectedMenuId}
            onSelect={(id) => {
              setError(null);
              setNotice(null);
              setNoticeType(null);
              setSelectedMenuId(id);
            }}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>메뉴 상세 / 권한</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {notice ? (
            <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>
              {notice}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-500">상세: {error}</p> : null}

          {selectedMenu ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>코드</Label>
                  <Input value={form.code} disabled />
                </div>
                <div className="space-y-2">
                  <Label>이름</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>부모 메뉴</Label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                    value={form.parent_id}
                    onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}
                  >
                    <option value="">(최상위)</option>
                    {flatMenus
                      .filter((m) => m.id !== selectedMenu.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {"-".repeat(Math.max(0, m.depth ?? 0))} {m.name} ({m.code})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>정렬 순서</Label>
                  <Input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>경로</Label>
                  <Input value={form.path} onChange={(e) => setForm((p) => ({ ...p, path: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>아이콘</Label>
                  <IconPickerGrid
                    value={form.icon}
                    onChange={(icon) => setForm((p) => ({ ...p, icon }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: Boolean(v) }))}
                />
                활성 메뉴
              </label>

              <div className="flex gap-2">
                <Button variant="save" onClick={saveMenu} disabled={saving}>저장</Button>
                <Button variant="destructive" onClick={removeMenu} disabled={saving}>삭제</Button>
              </div>

              <div className="space-y-2">
                <Label>접근 권한</Label>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {roles.map((role) => {
                    const checked = selectedRoleIds.includes(role.id);
                    return (
                      <label key={role.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedRoleIds((prev) =>
                              v ? [...prev, role.id] : prev.filter((id) => id !== role.id)
                            );
                          }}
                        />
                        {role.name} ({role.code})
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="save" onClick={saveRoles} disabled={saving}>저장</Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">왼쪽에서 메뉴를 선택해 주세요.</p>
          )}
        </CardContent>
      </Card>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>새 메뉴 생성</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>코드</Label>
                <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>이름</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>부모 메뉴</Label>
                <select
                  className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                  value={form.parent_id}
                  onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}
                >
                  <option value="">(최상위)</option>
                  {flatMenus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {"-".repeat(Math.max(0, m.depth ?? 0))} {m.name} ({m.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>경로</Label>
                <Input value={form.path} onChange={(e) => setForm((p) => ({ ...p, path: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>아이콘</Label>
                <IconPickerGrid
                  value={form.icon}
                  onChange={(icon) => setForm((p) => ({ ...p, icon }))}
                />
              </div>
              <div className="space-y-2">
                <Label>정렬 순서</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>
                  취소
                </Button>
                <Button variant="action" onClick={createMenu} disabled={saving}>생성</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
