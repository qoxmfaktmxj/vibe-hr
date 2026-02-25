"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  HriApprovalTemplateBatchResponse,
  HriApprovalTemplateItem,
  HriApprovalTemplateListResponse,
  HriApprovalTemplateStepBatchItem,
} from "@/types/hri";

type NoticeType = "success" | "error" | null;

const EMPTY_STEP = (): HriApprovalTemplateStepBatchItem => ({
  id: null,
  step_order: 1,
  step_type: "APPROVAL",
  actor_resolve_type: "ROLE_BASED",
  actor_role_code: "TEAM_LEADER",
  actor_user_id: null,
  allow_delegate: true,
  required_action: "APPROVE",
});

const EMPTY_FORM = {
  id: null as number | null,
  template_code: "",
  template_name: "",
  scope_type: "GLOBAL" as const,
  scope_id: "",
  is_default: false,
  is_active: true,
  priority: "100",
  steps: [EMPTY_STEP()],
};

const SCOPE_TYPES = ["GLOBAL", "COMPANY", "DEPT", "TEAM", "USER"] as const;
const STEP_TYPES = ["APPROVAL", "RECEIVE", "REFERENCE"] as const;
const RESOLVE_TYPES = ["ROLE_BASED", "USER_FIXED"] as const;
const ROLE_CODES = ["TEAM_LEADER", "DEPT_HEAD", "CEO", "HR_ADMIN"] as const;
type ScopeType = (typeof SCOPE_TYPES)[number];

type TemplateForm = {
  id: number | null;
  template_code: string;
  template_name: string;
  scope_type: ScopeType;
  scope_id: string;
  is_default: boolean;
  is_active: boolean;
  priority: string;
  steps: HriApprovalTemplateStepBatchItem[];
};

export function HriApprovalTemplateManager() {
  const [rows, setRows] = useState<HriApprovalTemplateItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<NoticeType>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);

  const selected = useMemo(() => rows.find((item) => item.id === selectedId) ?? null, [rows, selectedId]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!q) return true;
      return (
        row.template_code.toLowerCase().includes(q) ||
        row.template_name.toLowerCase().includes(q) ||
        row.scope_type.toLowerCase().includes(q)
      );
    });
  }, [query, rows]);

  useEffect(() => {
    void loadRows();
  }, []);

  useEffect(() => {
    if (createMode) {
      setForm(EMPTY_FORM);
      return;
    }
    if (!selected) return;
    setForm({
      id: selected.id,
      template_code: selected.template_code,
      template_name: selected.template_name,
      scope_type: selected.scope_type,
      scope_id: selected.scope_id ?? "",
      is_default: selected.is_default,
      is_active: selected.is_active,
      priority: String(selected.priority),
      steps: selected.steps.map((step) => ({
        id: step.id,
        step_order: step.step_order,
        step_type: step.step_type,
        actor_resolve_type: step.actor_resolve_type,
        actor_role_code: step.actor_role_code,
        actor_user_id: step.actor_user_id,
        allow_delegate: step.allow_delegate,
        required_action: step.required_action,
      })),
    });
  }, [createMode, selected]);

  async function loadRows() {
    setLoading(true);
    try {
      const res = await fetch("/api/hri/approval-templates", { cache: "no-store" });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "결재선 템플릿 조회에 실패했습니다.");
      }
      const data = raw as HriApprovalTemplateListResponse;
      setRows(data.items);
      setSelectedId((prev) => prev ?? data.items[0]?.id ?? null);
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "결재선 템플릿 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function upsertStep(index: number, patch: Partial<HriApprovalTemplateStepBatchItem>) {
    setForm((prev) => {
      const nextSteps = prev.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step));
      return { ...prev, steps: nextSteps };
    });
  }

  function removeStep(index: number) {
    setForm((prev) => {
      const next = prev.steps.filter((_, stepIndex) => stepIndex !== index);
      const reOrdered = next.map((step, stepIndex) => ({ ...step, step_order: stepIndex + 1 }));
      return { ...prev, steps: reOrdered.length > 0 ? reOrdered : [EMPTY_STEP()] };
    });
  }

  function addStep() {
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, { ...EMPTY_STEP(), step_order: prev.steps.length + 1 }],
    }));
  }

  async function saveTemplate() {
    if (!form.template_code.trim() || !form.template_name.trim()) {
      setNoticeType("error");
      setNotice("템플릿 코드와 템플릿명을 입력해 주세요.");
      return;
    }
    if (form.steps.length === 0) {
      setNoticeType("error");
      setNotice("최소 1개 이상의 결재 단계를 입력해야 합니다.");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        items: [
          {
            id: createMode ? null : form.id,
            template_code: form.template_code.trim().toUpperCase(),
            template_name: form.template_name.trim(),
            scope_type: form.scope_type,
            scope_id: form.scope_id.trim() || null,
            is_default: form.is_default,
            is_active: form.is_active,
            priority: Number(form.priority || "100"),
            steps: form.steps.map((step, index) => ({
              ...step,
              id: step.id && step.id > 0 ? step.id : null,
              step_order: index + 1,
              actor_role_code: step.actor_role_code?.trim() || null,
              actor_user_id:
                step.actor_resolve_type === "USER_FIXED" && step.actor_user_id
                  ? Number(step.actor_user_id)
                  : null,
            })),
          },
        ],
        delete_ids: [],
      };

      const res = await fetch("/api/hri/approval-templates/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "저장에 실패했습니다.");
      }
      const data = raw as HriApprovalTemplateBatchResponse;

      setRows(data.items);
      const savedCode = payload.items[0].template_code;
      const savedRow = data.items.find((item) => item.template_code === savedCode) ?? null;
      setSelectedId(savedRow?.id ?? null);
      setCreateMode(false);
      setNoticeType("success");
      setNotice("결재선 템플릿 저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate() {
    if (createMode || !selectedId) return;
    if (!confirm("선택한 결재선 템플릿을 삭제하시겠습니까?")) return;

    setSaving(true);
    setNotice(null);
    try {
      const payload = { items: [], delete_ids: [selectedId] };
      const res = await fetch("/api/hri/approval-templates/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "삭제에 실패했습니다.");
      }
      const data = raw as HriApprovalTemplateBatchResponse;

      setRows(data.items);
      setSelectedId(data.items[0]?.id ?? null);
      setNoticeType("success");
      setNotice("결재선 템플릿 삭제가 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setCreateMode(true);
    setSelectedId(null);
    setNotice(null);
  }

  function startCopy() {
    if (!selected) return;
    setCreateMode(true);
    setSelectedId(null);
    setNotice(null);
    setForm({
      id: null,
      template_code: `${selected.template_code}_COPY`,
      template_name: `${selected.template_name} 복사`,
      scope_type: selected.scope_type,
      scope_id: selected.scope_id ?? "",
      is_default: false,
      is_active: selected.is_active,
      priority: String(selected.priority),
      steps: selected.steps.map((step, index) => ({
        id: null,
        step_order: index + 1,
        step_type: step.step_type,
        actor_resolve_type: step.actor_resolve_type,
        actor_role_code: step.actor_role_code,
        actor_user_id: step.actor_user_id,
        allow_delegate: step.allow_delegate,
        required_action: step.required_action,
      })),
    });
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">결재선 템플릿을 불러오는 중입니다...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      {notice ? (
        <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">검색어</Label>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="템플릿코드, 템플릿명, 범위"
              />
            </div>
            <div className="flex items-end">
              <Button variant="query" onClick={() => undefined}>
                조회
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>결재선 템플릿 목록</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={startCreate}>
              입력
            </Button>
            <Button size="sm" variant="outline" onClick={startCopy} disabled={!selected}>
              복사
            </Button>
            <Button size="sm" variant="save" onClick={() => void saveTemplate()} disabled={saving}>
              저장
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void deleteTemplate()}
              disabled={saving || createMode || !selectedId}
            >
              삭제
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[280px] overflow-auto rounded-md border">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="border px-2 py-2 text-center">No</th>
                  <th className="border px-2 py-2 text-left">템플릿코드</th>
                  <th className="border px-2 py-2 text-left">템플릿명</th>
                  <th className="border px-2 py-2 text-center">범위</th>
                  <th className="border px-2 py-2 text-center">기본</th>
                  <th className="border px-2 py-2 text-center">사용</th>
                  <th className="border px-2 py-2 text-right">우선순위</th>
                  <th className="border px-2 py-2 text-right">단계수</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer ${!createMode && selectedId === row.id ? "bg-primary/10" : "odd:bg-white even:bg-slate-50"}`}
                    onClick={() => {
                      setCreateMode(false);
                      setSelectedId(row.id);
                      setNotice(null);
                    }}
                  >
                    <td className="border px-2 py-2 text-center">{index + 1}</td>
                    <td className="border px-2 py-2 font-mono text-xs">{row.template_code}</td>
                    <td className="border px-2 py-2">{row.template_name}</td>
                    <td className="border px-2 py-2 text-center">{row.scope_type}</td>
                    <td className="border px-2 py-2 text-center">{row.is_default ? "Y" : "N"}</td>
                    <td className="border px-2 py-2 text-center">{row.is_active ? "Y" : "N"}</td>
                    <td className="border px-2 py-2 text-right">{row.priority}</td>
                    <td className="border px-2 py-2 text-right">{row.steps.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-right text-xs text-slate-500">
            [{filteredRows.length} / {rows.length}]
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>템플릿코드</Label>
              <Input
                value={form.template_code}
                disabled={!createMode}
                onChange={(event) => setForm((prev) => ({ ...prev, template_code: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>템플릿명</Label>
              <Input
                value={form.template_name}
                onChange={(event) => setForm((prev) => ({ ...prev, template_name: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>우선순위</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>범위</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.scope_type}
                onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      scope_type: event.target.value as ScopeType,
                    }))
                }
              >
                {SCOPE_TYPES.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>범위 ID</Label>
              <Input
                value={form.scope_id}
                onChange={(event) => setForm((prev) => ({ ...prev, scope_id: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: Boolean(checked) }))}
              />
              사용
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.is_default}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_default: Boolean(checked) }))}
              />
              기본 템플릿
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>단계 설정</CardTitle>
          <Button size="sm" variant="outline" onClick={addStep}>
            단계 추가
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.steps.map((step, index) => (
            <div key={`${index}-${step.id ?? "new"}`} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">STEP {index + 1}</p>
                <Button size="xs" variant="destructive" onClick={() => removeStep(index)}>
                  삭제
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">STEP TYPE</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={step.step_type}
                    onChange={(event) =>
                      upsertStep(index, {
                        step_type: event.target.value as (typeof STEP_TYPES)[number],
                        required_action: event.target.value === "RECEIVE" ? "RECEIVE" : "APPROVE",
                      })
                    }
                  >
                    {STEP_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">RESOLVE TYPE</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={step.actor_resolve_type}
                    onChange={(event) =>
                      upsertStep(index, {
                        actor_resolve_type: event.target.value as (typeof RESOLVE_TYPES)[number],
                        actor_user_id: event.target.value === "USER_FIXED" ? step.actor_user_id : null,
                      })
                    }
                  >
                    {RESOLVE_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ROLE CODE</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={step.actor_role_code ?? ""}
                    disabled={step.actor_resolve_type === "USER_FIXED"}
                    onChange={(event) => upsertStep(index, { actor_role_code: event.target.value })}
                  >
                    {ROLE_CODES.map((roleCode) => (
                      <option key={roleCode} value={roleCode}>
                        {roleCode}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">USER ID (고정 사용자)</Label>
                  <Input
                    type="number"
                    value={step.actor_user_id ?? ""}
                    disabled={step.actor_resolve_type !== "USER_FIXED"}
                    onChange={(event) =>
                      upsertStep(index, {
                        actor_user_id: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={step.allow_delegate}
                    onCheckedChange={(checked) => upsertStep(index, { allow_delegate: Boolean(checked) })}
                  />
                  대결 허용
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
