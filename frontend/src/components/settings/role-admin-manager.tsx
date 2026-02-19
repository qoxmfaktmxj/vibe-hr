"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ColDef, GridApi, GridReadyEvent, RowClickedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { ensureAgGridRegistered } from "@/lib/ag-grid";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RoleItem } from "@/types/menu-admin";

ensureAgGridRegistered();

export function RoleAdminManager() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const gridApiRef = useRef<GridApi<RoleItem> | null>(null);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const columnDefs = useMemo<ColDef<RoleItem>[]>(
    () => [
      {
        headerName: "코드",
        field: "code",
        width: 180,
      },
      {
        headerName: "권한명",
        field: "name",
        flex: 1,
        minWidth: 180,
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<RoleItem>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    [],
  );

  const loadRoles = useCallback(async () => {
    setError(null);
    const rolesRes = await fetch("/api/menus/admin/roles", { cache: "no-store" });
    if (!rolesRes.ok) throw new Error("역할 목록을 불러오지 못했습니다.");

    const rolesJson = (await rolesRes.json()) as { roles: RoleItem[] };
    setRoles(rolesJson.roles);
    setSelectedRoleId((prev) => prev ?? rolesJson.roles[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadRoles();
      } catch (e) {
        setError(e instanceof Error ? e.message : "초기화 실패");
      }
    })();
  }, [loadRoles]);

  useEffect(() => {
    if (!selectedRoleId) {
      setCode("");
      setName("");
      return;
    }

    setName(selectedRole?.name ?? "");
    setCode(selectedRole?.code ?? "");
  }, [selectedRoleId, selectedRole]);

  useEffect(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.forEachNode((node) => {
      node.setSelected(node.data?.id === selectedRoleId);
    });
  }, [roles, selectedRoleId]);

  const onGridReady = useCallback((event: GridReadyEvent<RoleItem>) => {
    gridApiRef.current = event.api;
  }, []);

  const onRowClicked = useCallback((event: RowClickedEvent<RoleItem>) => {
    if (!event.data) return;
    setError(null);
    setNotice(null);
    setNoticeType(null);
    setSelectedRoleId(event.data.id);
  }, []);

  function startCreateMode() {
    setSelectedRoleId(null);
    setCode("");
    setName("");
    setError(null);
    setNotice(null);
    setNoticeType(null);
    gridApiRef.current?.deselectAll();
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
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>권한 목록</CardTitle>
            <Button size="sm" variant="outline" onClick={startCreateMode}>
              새 권한
            </Button>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="권한명/코드 검색"
          />
        </CardHeader>
        <CardContent>
          <div className="ag-theme-alpine h-[420px] w-full rounded-md border">
            <AgGridReact<RoleItem>
              rowData={roles}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              quickFilterText={search}
              rowSelection="single"
              suppressRowClickSelection={false}
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGridReady}
              onRowClicked={onRowClicked}
              overlayNoRowsTemplate="<span>권한이 없습니다.</span>"
            />
          </div>
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
              삭제
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
