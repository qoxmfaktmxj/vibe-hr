"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  HriFormTypeBatchResponse,
  HriFormTypeItem,
  HriFormTypeListResponse,
} from "@/types/hri";

const EDITABLE_STATUSES = new Set(["DRAFT", "APPROVAL_REJECTED", "RECEIVE_REJECTED"]);

const EMPTY_FORM = {
  id: null as number | null,
  form_code: "",
  form_name_ko: "",
  form_name_en: "",
  module_code: "COMMON",
  is_active: true,
  allow_draft: true,
  allow_withdraw: true,
  requires_receive: false,
  default_priority: "50",
};

type NoticeType = "success" | "error" | null;

export function HriFormTypeManager() {
  const [rows, setRows] = useState<HriFormTypeItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<NoticeType>(null);
  const [query, setQuery] = useState("");
  const [moduleQuery, setModuleQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const selected = useMemo(
    () => rows.find((item) => item.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const moduleCode = moduleQuery.trim().toUpperCase();
    return rows.filter((row) => {
      const byQ =
        !q ||
        row.form_code.toLowerCase().includes(q) ||
        row.form_name_ko.toLowerCase().includes(q) ||
        (row.form_name_en ?? "").toLowerCase().includes(q);
      const byModule = !moduleCode || row.module_code.toUpperCase() === moduleCode;
      return byQ && byModule;
    });
  }, [moduleQuery, query, rows]);

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
      form_code: selected.form_code,
      form_name_ko: selected.form_name_ko,
      form_name_en: selected.form_name_en ?? "",
      module_code: selected.module_code,
      is_active: selected.is_active,
      allow_draft: selected.allow_draft,
      allow_withdraw: selected.allow_withdraw,
      requires_receive: selected.requires_receive,
      default_priority: String(selected.default_priority),
    });
  }, [createMode, selected]);

  async function loadRows() {
    setLoading(true);
    try {
      const res = await fetch("/api/hri/form-types", { cache: "no-store" });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "신청서 코드 목록 조회에 실패했습니다.");
      }
      const data = raw as HriFormTypeListResponse;
      setRows(data.items);
      setSelectedId((prev) => prev ?? data.items[0]?.id ?? null);
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "신청서 코드 목록 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRow() {
    if (!form.form_code.trim() || !form.form_name_ko.trim()) {
      setNoticeType("error");
      setNotice("신청서코드와 신청서명을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        items: [
          {
            id: createMode ? null : form.id,
            form_code: form.form_code.trim().toUpperCase(),
            form_name_ko: form.form_name_ko.trim(),
            form_name_en: form.form_name_en.trim() || null,
            module_code: form.module_code.trim().toUpperCase() || "COMMON",
            is_active: form.is_active,
            allow_draft: form.allow_draft,
            allow_withdraw: form.allow_withdraw,
            requires_receive: form.requires_receive,
            default_priority: Number(form.default_priority || "50"),
          },
        ],
        delete_ids: [],
      };

      const res = await fetch("/api/hri/form-types/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "저장에 실패했습니다.");
      }
      const data = raw as HriFormTypeBatchResponse;

      setRows(data.items);
      const savedCode = payload.items[0].form_code;
      const savedRow = data.items.find((item) => item.form_code === savedCode) ?? null;
      setSelectedId(savedRow?.id ?? null);
      setCreateMode(false);
      setNoticeType("success");
      setNotice("신청서 코드 저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow() {
    if (createMode || !selectedId) return;
    if (!confirm("선택한 신청서 코드를 삭제하시겠습니까?")) return;

    setSaving(true);
    setNotice(null);
    try {
      const payload = { items: [], delete_ids: [selectedId] };
      const res = await fetch("/api/hri/form-types/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "삭제에 실패했습니다.");
      }
      const data = raw as HriFormTypeBatchResponse;
      setRows(data.items);
      setSelectedId(data.items[0]?.id ?? null);
      setNoticeType("success");
      setNotice("신청서 코드 삭제가 완료되었습니다.");
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
      form_code: `${selected.form_code}_COPY`,
      form_name_ko: `${selected.form_name_ko} 복사`,
      form_name_en: selected.form_name_en ?? "",
      module_code: selected.module_code,
      is_active: selected.is_active,
      allow_draft: selected.allow_draft,
      allow_withdraw: selected.allow_withdraw,
      requires_receive: selected.requires_receive,
      default_priority: String(selected.default_priority),
    });
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">신청서 코드 목록을 불러오는 중입니다...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      {notice ? (
        <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">검색어</Label>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="신청서코드 또는 신청서명"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">모듈코드</Label>
              <Input
                value={moduleQuery}
                onChange={(event) => setModuleQuery(event.target.value)}
                placeholder="예: TIM / HR / CPN"
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
          <CardTitle>신청서 코드 목록</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={startCreate}>
              입력
            </Button>
            <Button size="sm" variant="outline" onClick={startCopy} disabled={!selected}>
              복사
            </Button>
            <Button size="sm" variant="save" onClick={() => void saveRow()} disabled={saving}>
              저장
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void deleteRow()}
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
                  <th className="border px-2 py-2 text-left">신청서코드</th>
                  <th className="border px-2 py-2 text-left">신청서명</th>
                  <th className="border px-2 py-2 text-center">모듈</th>
                  <th className="border px-2 py-2 text-center">수신필요</th>
                  <th className="border px-2 py-2 text-center">사용</th>
                  <th className="border px-2 py-2 text-right">우선순위</th>
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
                    <td className="border px-2 py-2 font-mono text-xs">{row.form_code}</td>
                    <td className="border px-2 py-2">{row.form_name_ko}</td>
                    <td className="border px-2 py-2 text-center">{row.module_code}</td>
                    <td className="border px-2 py-2 text-center">{row.requires_receive ? "Y" : "N"}</td>
                    <td className="border px-2 py-2 text-center">{row.is_active ? "Y" : "N"}</td>
                    <td className="border px-2 py-2 text-right">{row.default_priority}</td>
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
              <Label>신청서코드</Label>
              <Input
                value={form.form_code}
                disabled={!createMode}
                onChange={(event) => setForm((prev) => ({ ...prev, form_code: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>신청서명(한글)</Label>
              <Input
                value={form.form_name_ko}
                onChange={(event) => setForm((prev) => ({ ...prev, form_name_ko: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>신청서명(영문)</Label>
              <Input
                value={form.form_name_en}
                onChange={(event) => setForm((prev) => ({ ...prev, form_name_en: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>모듈코드</Label>
              <Input
                value={form.module_code}
                onChange={(event) => setForm((prev) => ({ ...prev, module_code: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>우선순위</Label>
              <Input
                type="number"
                value={form.default_priority}
                onChange={(event) => setForm((prev) => ({ ...prev, default_priority: event.target.value }))}
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
                checked={form.allow_draft}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allow_draft: Boolean(checked) }))}
              />
              임시저장 허용
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.allow_withdraw}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allow_withdraw: Boolean(checked) }))}
              />
              회수 허용
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.requires_receive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, requires_receive: Boolean(checked) }))}
              />
              수신 처리 필요
            </label>
          </div>
          <p className="text-xs text-slate-500">
            참고: {Array.from(EDITABLE_STATUSES).join(", ")} 상태에서는 동일 신청서 재기안이 가능합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
