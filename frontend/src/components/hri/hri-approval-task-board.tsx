"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HriRequestActionResponse, HriTaskItem, HriTaskListResponse } from "@/types/hri";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  APPROVAL_IN_PROGRESS: "결재처리중",
  APPROVAL_REJECTED: "결재반려",
  RECEIVE_IN_PROGRESS: "수신처리중",
  RECEIVE_REJECTED: "수신반려",
  COMPLETED: "처리완료",
  WITHDRAWN: "회수",
};

type NoticeType = "success" | "error" | null;

export function HriApprovalTaskBoard() {
  const [rows, setRows] = useState<HriTaskItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<NoticeType>(null);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((item) => {
      if (!q) return true;
      return (
        item.request_no.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.form_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, rows]);

  useEffect(() => {
    void loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await fetch("/api/hri/tasks/my-approvals", { cache: "no-store" });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "결재함 조회에 실패했습니다.");
      }
      const data = raw as HriTaskListResponse;
      setRows(data.items);
      setSelectedId((prev) => prev ?? data.items[0]?.request_id ?? null);
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "결재함 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: "approve" | "reject", requestId: number) {
    setActing(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/hri/requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() || null }),
      });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const errorData = raw as { detail?: string } | null;
        throw new Error(errorData?.detail ?? "처리에 실패했습니다.");
      }
      const data = raw as HriRequestActionResponse;
      if (!data.request_id) throw new Error("처리 결과가 올바르지 않습니다.");
      setNoticeType("success");
      setNotice(action === "approve" ? "결재 승인 완료" : "결재 반려 완료");
      setComment("");
      await loadTasks();
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "처리에 실패했습니다.");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">결재함을 불러오는 중입니다...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      {notice ? (
        <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>{notice}</p>
      ) : null}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="문서번호, 제목, 신청서명 검색"
            />
            <Button variant="query" onClick={() => undefined}>
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>결재 대기 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full min-w-[1020px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="border px-2 py-2 text-center">No</th>
                  <th className="border px-2 py-2 text-left">문서번호</th>
                  <th className="border px-2 py-2 text-left">신청서유형</th>
                  <th className="border px-2 py-2 text-left">제목</th>
                  <th className="border px-2 py-2 text-center">상태</th>
                  <th className="border px-2 py-2 text-center">현재 STEP</th>
                  <th className="border px-2 py-2 text-center">요청일</th>
                  <th className="border px-2 py-2 text-center">처리</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((item, index) => (
                  <tr
                    key={`${item.request_id}-${item.step_order}`}
                    className={`odd:bg-white even:bg-slate-50 ${selectedId === item.request_id ? "bg-primary/10" : ""}`}
                    onClick={() => setSelectedId(item.request_id)}
                  >
                    <td className="border px-2 py-2 text-center">{index + 1}</td>
                    <td className="border px-2 py-2 font-mono text-xs">{item.request_no}</td>
                    <td className="border px-2 py-2">{item.form_name ?? "-"}</td>
                    <td className="border px-2 py-2">{item.title}</td>
                    <td className="border px-2 py-2 text-center">{STATUS_LABEL[item.status_code] ?? item.status_code}</td>
                    <td className="border px-2 py-2 text-center">{item.step_order}</td>
                    <td className="border px-2 py-2 text-center">{item.requested_at.slice(0, 10)}</td>
                    <td className="border px-2 py-2">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="xs"
                          variant="action"
                          onClick={() => void runAction("approve", item.request_id)}
                          disabled={acting}
                        >
                          승인
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={() => void runAction("reject", item.request_id)}
                          disabled={acting}
                        >
                          반려
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-right text-xs text-slate-500">
            [{filteredRows.length} / {rows.length}]
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>처리 의견</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>승인/반려 시 기록할 의견</Label>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="의견이 필요한 경우 입력해 주세요."
          />
        </CardContent>
      </Card>
    </div>
  );
}
