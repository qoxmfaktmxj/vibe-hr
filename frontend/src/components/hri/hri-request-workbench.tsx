"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  HriFormTypeItem,
  HriFormTypeListResponse,
  HriRequestActionResponse,
  HriRequestDetailResponse,
  HriRequestItem,
  HriRequestListResponse,
  HriRequestSubmitResponse,
} from "@/types/hri";

const EDITABLE_STATUSES = new Set(["DRAFT", "APPROVAL_REJECTED", "RECEIVE_REJECTED"]);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  APPROVAL_IN_PROGRESS: "결재처리중",
  APPROVAL_REJECTED: "결재반려",
  RECEIVE_IN_PROGRESS: "수신처리중",
  RECEIVE_REJECTED: "수신반려",
  COMPLETED: "처리완료",
  WITHDRAWN: "회수",
};

function statusClass(status: string) {
  if (status.includes("REJECTED")) return "bg-red-100 text-red-700";
  if (status.includes("IN_PROGRESS")) return "bg-blue-100 text-blue-700";
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (status === "DRAFT") return "bg-slate-100 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

type NoticeType = "success" | "error" | null;

export function HriRequestWorkbench() {
  const [formTypes, setFormTypes] = useState<HriFormTypeItem[]>([]);
  const [requests, setRequests] = useState<HriRequestItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<NoticeType>(null);
  const [query, setQuery] = useState("");

  const [draftRequestId, setDraftRequestId] = useState<number | null>(null);
  const [draftFormTypeId, setDraftFormTypeId] = useState<number>(0);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftJson, setDraftJson] = useState("{}");

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((item) => {
      if (!q) return true;
      return (
        item.request_no.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.form_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, requests]);

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [formTypeRes, requestRes] = await Promise.all([
        fetch("/api/hri/form-types", { cache: "no-store" }),
        fetch("/api/hri/requests/my", { cache: "no-store" }),
      ]);

      const formTypeRaw = (await formTypeRes.json().catch(() => null)) as unknown;
      if (!formTypeRes.ok) {
        const errorData = formTypeRaw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "신청서 코드 조회에 실패했습니다.");
      }
      const formTypeJson = formTypeRaw as HriFormTypeListResponse;

      const requestRaw = (await requestRes.json().catch(() => null)) as unknown;
      if (!requestRes.ok) {
        const errorData = requestRaw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "내 신청서 조회에 실패했습니다.");
      }
      const requestJson = requestRaw as HriRequestListResponse;

      const activeFormTypes = formTypeJson.items.filter((item) => item.is_active);
      setFormTypes(activeFormTypes);
      setRequests(requestJson.items);
      setSelectedRequestId((prev) => prev ?? requestJson.items[0]?.id ?? null);

      if (activeFormTypes.length > 0) {
        setDraftFormTypeId((prev) => prev || activeFormTypes[0].id);
      }
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "데이터 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function loadRequestIntoDraft(item: HriRequestItem) {
    setDraftRequestId(item.id);
    setDraftFormTypeId(item.form_type_id);
    setDraftTitle(item.title);
    setDraftJson(formatJson(item.content_json));
  }

  function resetDraftForm() {
    setDraftRequestId(null);
    setDraftTitle("");
    setDraftJson("{}");
    if (formTypes.length > 0) {
      setDraftFormTypeId(formTypes[0].id);
    }
  }

  async function saveDraft() {
    if (!draftFormTypeId || !draftTitle.trim()) {
      setNoticeType("error");
      setNotice("신청서 유형과 제목을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const parsed = JSON.parse(draftJson || "{}") as Record<string, unknown>;
      const payload = {
        request_id: draftRequestId,
        form_type_id: draftFormTypeId,
        title: draftTitle.trim(),
        content_json: parsed,
      };

      const res = await fetch("/api/hri/requests/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "임시저장에 실패했습니다.");
      }
      const data = raw as HriRequestDetailResponse;

      setDraftRequestId(data.request.id);
      setNoticeType("success");
      setNotice("임시저장이 완료되었습니다.");
      await loadAll();
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "임시저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function submitRequest(requestId: number) {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/hri/requests/${requestId}/submit`, { method: "POST" });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "제출에 실패했습니다.");
      }
      const data = raw as HriRequestSubmitResponse;
      if (!data.request_id) throw new Error("제출 처리 결과가 올바르지 않습니다.");
      setNoticeType("success");
      setNotice("신청서 제출이 완료되었습니다.");
      await loadAll();
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "제출에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function withdrawRequest(requestId: number) {
    if (!confirm("해당 신청서를 회수하시겠습니까?")) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/hri/requests/${requestId}/withdraw`, { method: "POST" });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "회수에 실패했습니다.");
      }
      const data = raw as HriRequestActionResponse;
      if (!data.request_id) throw new Error("회수 처리 결과가 올바르지 않습니다.");
      setNoticeType("success");
      setNotice("신청서 회수가 완료되었습니다.");
      await loadAll();
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "회수에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">신청서 데이터를 불러오는 중입니다...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      {notice ? (
        <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>신청서 작성</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={resetDraftForm}>
              신규 작성
            </Button>
            <Button size="sm" variant="save" onClick={() => void saveDraft()} disabled={saving}>
              임시저장
            </Button>
            {draftRequestId ? (
              <Button
                size="sm"
                variant="action"
                onClick={() => void submitRequest(draftRequestId)}
                disabled={saving}
              >
                저장 후 제출
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>신청서유형</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={draftFormTypeId}
                onChange={(event) => setDraftFormTypeId(Number(event.target.value))}
              >
                {formTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.form_name_ko} ({item.form_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>제목</Label>
              <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>내용(JSON)</Label>
            <textarea
              className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={draftJson}
              onChange={(event) => setDraftJson(event.target.value)}
              placeholder='예: {"reason":"근태 정정", "work_date":"2026-02-25"}'
            />
          </div>
          {draftRequestId ? (
            <p className="text-xs text-slate-500">
              현재 편집중 문서 ID: <span className="font-mono">{draftRequestId}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>내 신청서</CardTitle>
          <div className="w-72">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="문서번호, 제목, 신청서명 검색"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="border px-2 py-2 text-center">No</th>
                  <th className="border px-2 py-2 text-left">문서번호</th>
                  <th className="border px-2 py-2 text-left">신청서유형</th>
                  <th className="border px-2 py-2 text-left">제목</th>
                  <th className="border px-2 py-2 text-center">상태</th>
                  <th className="border px-2 py-2 text-center">현재결재자</th>
                  <th className="border px-2 py-2 text-center">작성일</th>
                  <th className="border px-2 py-2 text-center">액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`odd:bg-white even:bg-slate-50 ${selectedRequestId === item.id ? "bg-primary/10" : ""}`}
                    onClick={() => setSelectedRequestId(item.id)}
                  >
                    <td className="border px-2 py-2 text-center">{index + 1}</td>
                    <td className="border px-2 py-2 font-mono text-xs">{item.request_no}</td>
                    <td className="border px-2 py-2">{item.form_name ?? "-"}</td>
                    <td className="border px-2 py-2">{item.title}</td>
                    <td className="border px-2 py-2 text-center">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(item.status_code)}`}>
                        {STATUS_LABEL[item.status_code] ?? item.status_code}
                      </span>
                    </td>
                    <td className="border px-2 py-2 text-center">{item.current_actor_name ?? "-"}</td>
                    <td className="border px-2 py-2 text-center">{item.created_at.slice(0, 10)}</td>
                    <td className="border px-2 py-2">
                      <div className="flex justify-center gap-1">
                        <Button size="xs" variant="outline" onClick={() => loadRequestIntoDraft(item)}>
                          불러오기
                        </Button>
                        {EDITABLE_STATUSES.has(item.status_code) ? (
                          <Button
                            size="xs"
                            variant="action"
                            onClick={() => void submitRequest(item.id)}
                            disabled={saving}
                          >
                            재제출
                          </Button>
                        ) : null}
                        {item.status_code === "APPROVAL_IN_PROGRESS" ? (
                          <Button
                            size="xs"
                            variant="warning"
                            onClick={() => void withdrawRequest(item.id)}
                            disabled={saving}
                          >
                            회수
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-right text-xs text-slate-500">
            [{filteredRequests.length} / {requests.length}]
          </div>

          {selectedRequest ? (
            <div className="mt-3 rounded-md border bg-slate-50 p-3">
              <p className="mb-2 text-sm font-semibold">선택 문서 JSON 미리보기</p>
              <pre className="max-h-56 overflow-auto rounded-md bg-white p-3 text-xs">
                {formatJson(selectedRequest.content_json)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
