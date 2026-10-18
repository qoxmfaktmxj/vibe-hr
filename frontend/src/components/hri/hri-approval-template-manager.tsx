"use client";

import type { ColDef } from "ag-grid-community";
import { useAuth } from "@/components/auth/auth-provider";
import { BatchGridManager, type BatchGridRow } from "@/components/grid/batch-grid-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HriApprovalTemplateBatchItem, HriApprovalTemplateStepBatchItem } from "@/types/hri";

type Template = Omit<HriApprovalTemplateBatchItem, "id"> & { id: number };
type Row = BatchGridRow<Template>;
const emptyStep = (): HriApprovalTemplateStepBatchItem => ({ id: null, step_order: 1, step_type: "APPROVAL", actor_resolve_type: "ROLE_BASED", actor_role_code: "TEAM_LEADER", actor_user_id: null, allow_delegate: true, required_action: "APPROVE" });
const columns: ColDef<Row>[] = [
  { field: "template_code", headerName: "템플릿 코드", minWidth: 170, valueParser: p => String(p.newValue ?? "").trim().toUpperCase() },
  { field: "template_name", headerName: "템플릿명", minWidth: 200, flex: 1 },
  { field: "scope_type", headerName: "적용 범위", cellEditor: "agSelectCellEditor", cellEditorParams: { values: ["GLOBAL", "COMPANY", "DEPT", "TEAM", "USER"] } },
  { field: "scope_id", headerName: "범위 ID" },
  { field: "priority", headerName: "우선순위", cellDataType: "number" },
  { field: "is_default", headerName: "기본 템플릿", cellDataType: "boolean" },
  { field: "is_active", headerName: "사용", cellDataType: "boolean" },
  { colId: "step_count", headerName: "단계 수", editable: false, valueGetter: p => p.data?.steps.length ?? 0 },
];
const toItem = (row: Template) => ({ template_code: row.template_code.trim().toUpperCase(), template_name: row.template_name.trim(), scope_type: row.scope_type, scope_id: row.scope_id?.trim() || null, priority: row.priority, is_default: row.is_default, is_active: row.is_active, steps: row.steps.map((step, index) => ({ id: step.id && step.id > 0 ? step.id : null, step_order: index + 1, step_type: step.step_type, actor_resolve_type: step.actor_resolve_type, actor_role_code: step.actor_role_code?.trim() || null, actor_user_id: step.actor_resolve_type === "USER_FIXED" ? step.actor_user_id : null, allow_delegate: step.allow_delegate, required_action: step.step_type === "RECEIVE" ? "RECEIVE" : "APPROVE" })) });
const newRow = (id: number): Template => ({ id, template_code: "", template_name: "", scope_type: "GLOBAL", scope_id: null, priority: 100, is_default: false, is_active: true, steps: [emptyStep()] });
function validate(row: Template) {
  if (!row.template_code.trim() || !row.template_name.trim()) return "템플릿 코드와 템플릿명을 입력해 주세요.";
  if (row.template_code.length > 30 || row.template_name.length > 100 || (row.scope_id?.length ?? 0) > 40) return "템플릿 코드 30자, 이름 100자, 범위 ID 40자 이하로 입력해 주세요.";
  if (!Number.isInteger(row.priority)) return "우선순위를 정수로 입력해 주세요.";
  if (!row.steps.length || row.steps.length > 99) return "결재 단계는 1개 이상 99개 이하로 설정해 주세요.";
  if (row.steps.some(step => step.actor_resolve_type === "USER_FIXED" ? !Number.isInteger(step.actor_user_id) || Number(step.actor_user_id) <= 0 : !step.actor_role_code)) return "각 단계의 역할 또는 고정 사용자 ID를 지정해 주세요.";
  return null;
}
function TemplateSteps({ row, change, disabled }: { row: Row; change: (patch: Partial<Template>) => void; disabled: boolean }) {
  const update = (index: number, patch: Partial<HriApprovalTemplateStepBatchItem>) => change({ steps: row.steps.map((step, i) => i === index ? { ...step, ...patch } : step) });
  return <section className="rounded-md border border-border p-4" aria-label="결재 단계 설정"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold">{row.template_name || "새 템플릿"} 단계 설정</h3><p className="mt-1 text-xs text-muted-foreground">단계 변경도 위 저장 버튼으로 템플릿과 함께 반영합니다.</p></div><Button size="sm" variant="outline" disabled={disabled} onClick={() => change({ steps: [...row.steps, { ...emptyStep(), step_order: row.steps.length + 1 }] })}>단계 추가</Button></div>
    {row.steps.map((step, index) => <fieldset key={index} disabled={disabled} className="mb-3 space-y-3 border-t border-border pt-3"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">{index + 1}단계</h4><Button size="sm" variant="outline" onClick={() => change({ steps: row.steps.filter((_, i) => i !== index).map((item, i) => ({ ...item, step_order: i + 1 })) })}>단계 삭제</Button></div><div className="grid gap-3 md:grid-cols-4">
      <label className="text-xs text-muted-foreground">단계 유형<select aria-label={`${index + 1}단계 유형`} className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm" value={step.step_type} onChange={e => update(index, { step_type: e.target.value as typeof step.step_type, required_action: e.target.value === "RECEIVE" ? "RECEIVE" : "APPROVE" })}><option value="APPROVAL">결재</option><option value="RECEIVE">수신</option><option value="REFERENCE">참조</option></select></label>
      <label className="text-xs text-muted-foreground">지정 방식<select aria-label={`${index + 1}단계 지정 방식`} className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm" value={step.actor_resolve_type} onChange={e => update(index, { actor_resolve_type: e.target.value as typeof step.actor_resolve_type, actor_user_id: e.target.value === "USER_FIXED" ? step.actor_user_id : null })}><option value="ROLE_BASED">역할 기준</option><option value="USER_FIXED">사용자 지정</option></select></label>
      <label className="text-xs text-muted-foreground">역할<select aria-label={`${index + 1}단계 역할`} className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm" value={step.actor_role_code ?? ""} disabled={disabled || step.actor_resolve_type === "USER_FIXED"} onChange={e => update(index, { actor_role_code: e.target.value })}>{["TEAM_LEADER", "DEPT_HEAD", "CEO", "HR_ADMIN"].map(role => <option key={role} value={role}>{role}</option>)}</select></label>
      <label className="text-xs text-muted-foreground">고정 사용자 ID<Input aria-label={`${index + 1}단계 사용자 ID`} type="number" min={1} className="mt-1 h-9" value={step.actor_user_id ?? ""} disabled={disabled || step.actor_resolve_type !== "USER_FIXED"} onChange={e => update(index, { actor_user_id: e.target.value ? Number(e.target.value) : null })} /></label>
    </div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={step.allow_delegate} onChange={e => update(index, { allow_delegate: e.target.checked })} />대결 허용</label></fieldset>)}
  </section>;
}
export function HriApprovalTemplateManager() {
  const { user } = useAuth();
  return <div className="business-workspace"><BatchGridManager title="결재선 템플릿" listUrl="/api/hri/approval-templates" saveUrl="/api/hri/approval-templates/batch" columns={columns} newRow={newRow} toItem={toItem} validate={validate} canSave={Boolean(user?.roles.some(role => ["hr_manager", "admin"].includes(role)))} searchText={row => `${row.template_code} ${row.template_name} ${row.scope_type}`} searchPlaceholder="코드, 템플릿명, 범위 검색" copyRow={(row, id) => ({ ...row, id, template_code: `${row.template_code}_COPY`, template_name: `${row.template_name} 복사`, is_default: false, steps: row.steps.map(step => ({ ...step, id: null })) })} detailComponent={TemplateSteps} /></div>;
}
