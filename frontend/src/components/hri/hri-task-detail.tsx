"use client";

import useSWR from "swr";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormDetailView } from "@/components/hri/hri-form-detail";
import { fetcher } from "@/lib/fetcher";
import type { HriRequestDetailFullResponse } from "@/types/hri";

const STATUS: Record<string, string> = { APPROVAL_IN_PROGRESS: "결재 진행 중", RECEIVE_IN_PROGRESS: "수신 진행 중", COMPLETED: "완료", APPROVAL_REJECTED: "반려", RECEIVE_REJECTED: "수신 반려", WITHDRAWN: "회수" };
const ACTION: Record<string, string> = { WAITING: "대기", APPROVED: "승인", REJECTED: "반려", RECEIVED: "수신 완료" };

export function HriTaskDetail({ requestId, disabled, onApprove, onReject, onBack, focusOnOpen }: {
  requestId: number | null; disabled: boolean; onApprove: () => void; onReject: () => void; onBack: () => void;
  focusOnOpen: boolean;
}) {
  const { data, error, isLoading, mutate } = useSWR<HriRequestDetailFullResponse>(requestId ? `/api/hri/requests/${requestId}` : null, fetcher, { revalidateOnFocus: false });
  const request = data?.request;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusOnOpen && request && window.matchMedia("(max-width: 1279px)").matches) headingRef.current?.focus(); }, [focusOnOpen, request]);
  const actionable = !disabled && !isLoading && !error && request?.id === requestId && request.status_code === "APPROVAL_IN_PROGRESS";
  return <section className="flex min-w-0 flex-col rounded-md border border-border bg-card" aria-label="결재 문서 상세">
    <div className="border-b border-border px-5 py-3 xl:hidden"><Button size="sm" variant="outline" onClick={onBack}>목록으로</Button></div>
    <div className="min-h-0 flex-1 space-y-6 p-5">
      {!requestId ? <p className="text-sm text-muted-foreground">목록에서 문서를 선택하면 신청 내용과 결재 진행을 확인할 수 있습니다.</p>
        : isLoading ? <p role="status" className="text-sm text-muted-foreground">신청 내용을 불러오는 중입니다.</p>
          : error ? <div role="alert"><p className="mb-3 text-sm text-destructive">문서를 불러오지 못했습니다.</p><Button variant="outline" size="sm" onClick={() => void mutate()}>다시 시도</Button></div>
            : request && <>
              <header><p className="text-xs font-semibold text-primary">{STATUS[request.status_code] ?? request.status_code}</p><h2 ref={headingRef} tabIndex={-1} className="mt-2 break-words text-xl font-bold outline-none">{request.title}</h2><p className="mt-1 text-xs text-muted-foreground">{request.request_no}</p></header>
              <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 text-sm"><div><dt className="text-xs text-muted-foreground">제출일</dt><dd className="mt-1">{request.submitted_at?.slice(0, 10) ?? "-"}</dd></div><div><dt className="text-xs text-muted-foreground">현재 결재자</dt><dd className="mt-1">{request.current_actor_name ?? "-"}</dd></div></dl>
              <section className="break-words"><h3 className="mb-3 text-sm font-semibold">신청 내용</h3><FormDetailView formCode={request.form_code} data={request.detail_data} /></section>
              <section className="border-t border-border pt-5"><h3 className="mb-3 text-sm font-semibold">결재 진행</h3><ol className="space-y-3">{request.steps.map(step => <li key={step.id} className="border-b border-border/60 pb-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{step.step_order}차 {step.actor_name}</span><span className="text-muted-foreground">{ACTION[step.action_status] ?? step.action_status}</span></div>{step.comment && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{step.comment}</p>}{step.acted_at && <p className="mt-1 text-xs text-muted-foreground">{step.acted_at.slice(0, 16).replace("T", " ")}</p>}</li>)}</ol>{!request.steps.length && <p className="text-sm text-muted-foreground">결재선 정보가 없습니다.</p>}</section>
            </>}
    </div>
    <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card px-5 pt-3 pb-32 xl:pb-3"><Button variant="outline" size="sm" disabled={!actionable} onClick={onReject}>문서 반려</Button><Button size="sm" disabled={!actionable} onClick={onApprove}>문서 승인</Button></div>
  </section>;
}
