"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi } from "ag-grid-community";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ManagerPageShell, ManagerSearchSection, ManagerGridSection } from "@/components/grid/manager-layout";
import { GridToolbarActions } from "@/components/grid/grid-toolbar-actions";
import { GridPaginationControls } from "@/components/grid/grid-pagination-controls";
import { GridChangeSummaryBadges } from "@/components/grid/grid-change-summary-badges";
import { useGridPagination } from "@/lib/grid/use-grid-pagination";
import { useUnsavedNavigation } from "@/lib/grid/use-unsaved-navigation";
import { buildGridRowClassRules, getGridRowClass, getGridStatusCellClass, summarizeGridStatuses, type GridStatus } from "@/lib/grid/grid-status";
import { reconcileUpdatedStatus, toggleDeletedStatus } from "@/lib/grid/grid-status-mutations";
import { snapshotFields, isRowRevertedToOriginal } from "@/lib/hr/grid-change-tracker";
import { TAB_COLUMN_LABELS, rowsByTab, toCategory, buildProfileDraft, asNullable, stringifyErrorDetail, type TabKey, type BasicProfileDraft, type BasicProfileKey } from "@/lib/hr/hr-basic";
import type { HrBasicDetailResponse, HrInfoRow } from "@/types/hr-employee-profile";

type Row = HrInfoRow & { _status: GridStatus; _original?: Record<string, unknown>; _prevStatus?: GridStatus };
const FIELDS = ["record_date", "type", "title", "organization", "value", "note"] as const;
const TABS: [TabKey, string][] = [["basic", "인사기본"], ["appointment", "발령"], ["reward", "상벌"], ["contact", "주소연락처"], ["education", "학력"], ["career", "경력"], ["certificate", "자격증"], ["military", "병역"], ["evaluation", "평가"]];
const PROFILE_SECTIONS: { title: string; fields: [BasicProfileKey, string, string?][] }[] = [
  { title: "재직 정보", fields: [["full_name", "성명"], ["hire_date", "입사일", "date"], ["retire_date", "퇴사일", "date"], ["probation_end_date", "수습종료일", "date"], ["job_family", "직군"], ["job_role", "직무"], ["grade", "직급"]] },
  { title: "추가 기본정보", fields: [["gender", "성별"], ["resident_no_masked", "주민번호"], ["blood_type", "혈액형"], ["marital_status", "혼인상태"], ["mbti", "MBTI"]] },
];
function initialRows(items: HrInfoRow[]): Row[] {
  return items.map(item => {
    const row = { ...item, ...Object.fromEntries(FIELDS.map(field => [field, field === "record_date" ? (item[field] ?? "").slice(0, 10) : item[field] ?? ""])), _status: "clean" as const };
    return { ...row, _original: snapshotFields(row, FIELDS) };
  });
}

export function HrBasicTabs({ detail, employeeId, onReload, leaveRef }: {
  detail: HrBasicDetailResponse; employeeId: number; onReload: () => Promise<void>;
  leaveRef: MutableRefObject<(proceed: () => void) => void>;
}) {
  const [tab, setTab] = useState<TabKey>("basic");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<BasicProfileDraft>(() => buildProfileDraft(detail));
  const [workingRows, setWorkingRows] = useState<Row[] | null>(null);
  const rows = useMemo(() => workingRows ?? initialRows(tab === "basic" ? [] : rowsByTab(detail, tab)), [detail, tab, workingRows]);
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const tempId = useRef(-1);
  const api = useRef<GridApi<Row> | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const sourceProfile = buildProfileDraft(detail);
  const profileDirty = editing && JSON.stringify(profile) !== JSON.stringify(sourceProfile);
  const summary = summarizeGridStatuses(rows, row => row._status);
  const changed = summary.added + summary.updated + summary.deleted;
  const commitRows = useCallback((next: Row[]) => { rowsRef.current = next; setWorkingRows(next); setFeedback(null); }, []);
  const isDirty = useCallback(() => { api.current?.stopEditing(); return profileDirty || rowsRef.current.some(row => row._status !== "clean"); }, [profileDirty]);
  const blocked = useCallback(() => inFlight.current, []);
  const { requestLeave, dialog } = useUnsavedNavigation(isDirty, blocked);
  useEffect(() => { leaveRef.current = requestLeave; return () => { leaveRef.current = action => action(); }; }, [leaveRef, requestLeave]);
  const reset = () => { setWorkingRows(null); rowsRef.current = initialRows(tab === "basic" ? [] : rowsByTab(detail, tab)); setEditing(false); setProfile(buildProfileDraft(detail)); setFeedback(null); };
  const switchTab = (next: TabKey) => { if (next !== tab) requestLeave(() => { reset(); setTab(next); setPage(1); }); };
  const pagination = useGridPagination({ page, totalCount: rows.length, pageSize: 50, onPageChange: next => { if (next !== page) requestLeave(() => { reset(); setPage(next); }); } });
  const pageRows = rows.slice((page - 1) * 50, page * 50);
  const labels = tab === "basic" ? null : TAB_COLUMN_LABELS[tab];
  const rowClassRules = useMemo(() => buildGridRowClassRules<Row>(), []);
  const columns = useMemo<ColDef<Row>[]>(() => !labels ? [] : [
    { colId: "delete", headerName: "삭제", width: 65, pinned: "left", editable: false, sortable: false, filter: false,
      cellRenderer: ({ data }: { data?: Row }) => data && <input type="checkbox" aria-label={`${data.title || "신규 이력"} 삭제 표시`} checked={data._status === "deleted"} disabled={saving} onChange={event => commitRows(toggleDeletedStatus(rowsRef.current, data.id, event.target.checked, { removeAddedRow: true, shouldBeClean: row => isRowRevertedToOriginal(row, FIELDS) }))} /> },
    { colId: "status", headerName: "상태", width: 70, editable: false, valueGetter: ({ data }) => ({ clean: "", added: "입력", updated: "수정", deleted: "삭제" })[data?._status ?? "clean"] },
    ...FIELDS.map(field => ({ field, headerName: ({ record_date: labels.recordDate, type: labels.type, title: labels.title, organization: labels.organization, value: labels.value, note: labels.note })[field], minWidth: field === "title" || field === "note" ? 170 : 120, flex: field === "title" || field === "note" ? 1 : undefined, cellEditor: field === "record_date" ? "agDateStringCellEditor" : "agTextCellEditor", cellDataType: field === "record_date" ? "dateString" : "text" })),
  ], [labels, saving, commitRows]);

  async function save() {
    if (inFlight.current) return;
    api.current?.stopEditing();
    const changes = rowsRef.current.filter(row => row._status !== "clean");
    if (tab !== "basic" && !changes.length) return;
    if (tab === "basic" && !profileDirty) return;
    if (tab === "basic" && profile.full_name.trim().length < 2) { setFeedback({ error: true, text: "성명은 두 글자 이상 입력해 주세요." }); return; }
    if (tab === "basic" && !profile.hire_date) { setFeedback({ error: true, text: "입사일을 입력해 주세요." }); return; }
    if (changes.some(row => row._status !== "deleted" && !row.title?.trim())) { setFeedback({ error: true, text: `${labels?.title ?? "제목"}을 입력해 주세요.` }); return; }
    inFlight.current = true; setSaving(true); setFeedback(null);
    try {
      const response = await fetch(`/api/hr/basic/${employeeId}/${tab === "basic" ? "profile" : "records/batch"}`, {
        method: tab === "basic" ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tab === "basic" ? Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, asNullable(value)])) : {
          category: toCategory(tab),
          items: changes.filter(row => row._status !== "deleted").map(row => ({ id: row._status === "added" ? null : row.id, ...Object.fromEntries(FIELDS.map(field => [field, asNullable(String(row[field] ?? ""))])) })),
          delete_ids: changes.filter(row => row._status === "deleted").map(row => row.id),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(stringifyErrorDetail(body) ?? "저장에 실패했습니다.");
      if (tab !== "basic") { const saved = initialRows(body.items); rowsRef.current = saved; setWorkingRows(saved); setPage(1); }
      else setEditing(false);
      setFeedback({ error: false, text: tab === "basic" ? "기본정보가 저장되었습니다." : `저장 완료: 입력 ${body.inserted_count}건, 수정 ${body.updated_count}건, 삭제 ${body.deleted_count}건` });
      try { await onReload(); } catch { setFeedback({ error: true, text: "저장은 완료되었지만 재조회에 실패했습니다. 조회를 눌러 확인해 주세요." }); }
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "저장에 실패했습니다. 입력 내용은 유지됩니다." }); }
    finally { inFlight.current = false; setSaving(false); }
  }

  return <>
    <nav aria-label="인사 정보 탭" className="mb-5 flex overflow-x-auto border-b border-border">{TABS.map(([value, label]) => <button type="button" key={value} aria-current={tab === value ? "page" : undefined} disabled={saving} className={`shrink-0 border-b-2 px-3 py-3 text-sm ${tab === value ? "border-primary font-bold text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => switchTab(value)}>{label}</button>)}</nav>
    {feedback && <p role={feedback.error ? "alert" : "status"} className={`mb-4 text-sm ${feedback.error ? "text-destructive" : "text-muted-foreground"}`}>{feedback.text}</p>}
    {tab === "basic" ? <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{profileDirty ? "저장되지 않은 기본정보 변경이 있습니다." : "기본 정보와 재직 정보를 확인합니다."}</p><div className="flex gap-2">{editing ? <><Button size="sm" variant="outline" disabled={saving} onClick={() => requestLeave(reset)}>수정 취소</Button><Button size="sm" disabled={saving || !profileDirty} onClick={() => void save()}>{saving ? "저장 중..." : "기본정보 저장"}</Button></> : <Button size="sm" variant="outline" onClick={() => { setProfile(buildProfileDraft(detail)); setEditing(true); setFeedback(null); }}>수정</Button>}</div></div>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_230px]"><div>
        {PROFILE_SECTIONS.map(section => <section key={section.title} className="grid gap-5 border-b border-border py-5 md:grid-cols-[120px_minmax(0,1fr)]"><h2 className="text-sm font-semibold">{section.title}</h2><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{section.fields.map(([key, label, type]) => <div key={key}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1">{editing ? <Input aria-label={label} type={type ?? "text"} disabled={saving} value={profile[key]} onChange={event => setProfile(prev => ({ ...prev, [key]: event.target.value }))} className="h-9" /> : <span className="break-words text-sm">{sourceProfile[key] || "-"}</span>}</dd></div>)}</dl></section>)}
      </div><aside className="rounded-md bg-muted/40 p-4"><h2 className="text-sm font-semibold">최근 발령</h2>{detail.appointments.slice(0, 2).map(row => <div key={row.id} className="mt-4 border-b border-border pb-3"><p className="text-sm">{row.title || "발령"}</p><p className="mt-1 text-xs text-muted-foreground">{row.record_date?.slice(0, 10) || "-"}</p></div>)}{!detail.appointments.length && <p className="mt-3 text-sm text-muted-foreground">등록된 발령이 없습니다.</p>}<button type="button" className="mt-4 text-xs font-semibold text-primary" onClick={() => switchTab("appointment")}>발령 이력 전체 보기</button></aside></div>
    </> : <ManagerPageShell className="h-auto min-h-0 gap-3 p-0 md:p-0">
      <ManagerSearchSection title={labels!.tableTitle} queryDisabled={saving} onQuery={() => requestLeave(() => { reset(); void onReload().catch(() => setFeedback({ error: true, text: "이력을 다시 불러오지 못했습니다." })); })} queryButtonClassName="h-9" className="business-search"><p className="text-xs text-muted-foreground">추가, 수정, 삭제 표시한 내용을 저장 버튼으로 일괄 반영합니다.</p></ManagerSearchSection>
      <ManagerGridSection className="shadow-none" headerClassName="flex-wrap [&>div:first-child]:flex-wrap" headerLeft={<><GridPaginationControls page={page} totalPages={pagination.totalPages} pageInput={pagination.pageInput} setPageInput={pagination.setPageInput} goPrev={pagination.goPrev} goNext={pagination.goNext} goToPage={pagination.goToPage} disabled={saving} /><span className="text-xs text-muted-foreground">총 {rows.length}건</span><GridChangeSummaryBadges summary={summary} /></>} headerRight={<GridToolbarActions actions={[{ key: "create", label: "입력", icon: Plus, disabled: saving, onClick: () => { api.current?.stopEditing(); const added: Row = { id: tempId.current--, category: toCategory(tab), created_at: "", ...Object.fromEntries(FIELDS.map(field => [field, ""])), _status: "added" }; commitRows([added, ...rowsRef.current]); setPage(1); } }]} saveAction={{ key: "save", label: saving ? "저장 중..." : changed ? `변경 ${changed}건 저장` : "저장", icon: Save, disabled: saving || !changed, onClick: () => void save() }} />}>
        <div className="ag-theme-quartz vibe-grid h-[420px] min-w-0 overflow-hidden border-t border-border"><AgGridReact<Row> theme="legacy" rowData={pageRows} columnDefs={columns} defaultColDef={{ sortable: true, resizable: true, filter: true, editable: params => !saving && params.data?._status !== "deleted", cellClass: params => getGridStatusCellClass(params.data?._status) }} rowClassRules={rowClassRules} getRowClass={params => getGridRowClass(params.data?._status)} getRowId={params => String(params.data.id)} onGridReady={event => { api.current = event.api; }} onGridPreDestroyed={() => { api.current = null; }} onCellValueChanged={event => { if (!event.data) return; const next = { ...event.data, ...Object.fromEntries(FIELDS.map(field => [field, String(event.data?.[field] ?? "").trim()])) }; commitRows(rowsRef.current.map(row => row.id === next.id ? reconcileUpdatedStatus(next, { shouldBeClean: value => isRowRevertedToOriginal(value, FIELDS) }) : row)); }} singleClickEdit={false} animateRows={false} rowHeight={34} headerHeight={36} overlayNoRowsTemplate={`<span>${labels!.emptyMessage}</span>`} /></div>
      </ManagerGridSection>
    </ManagerPageShell>}
    {dialog}
  </>;
}
