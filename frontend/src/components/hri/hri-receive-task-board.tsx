"use client";

import { useCallback, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { HriRequestActionResponse, HriTaskItem, HriTaskListResponse } from "@/types/hri";

type ReceiveTaskGridRow = HriTaskItem & ReadonlyGridRow;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "임시저장",
  APPROVAL_IN_PROGRESS: "결재 진행중",
  APPROVAL_REJECTED: "결재 반려",
  RECEIVE_IN_PROGRESS: "수신 진행중",
  RECEIVE_REJECTED: "수신 반려",
  COMPLETED: "처리 완료",
  WITHDRAWN: "회수",
};

const STEP_TYPE_LABELS: Record<string, string> = {
  APPROVAL: "결재",
  RECEIVE: "수신",
  REFERENCE: "참조",
};

export function HriReceiveTaskBoard() {
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | null>(null);
  const [page, setPage] = useState(1);
  const [actingRequestId, setActingRequestId] = useState<number | null>(null);
  const pageSize = 50;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    return `/api/hri/tasks/my-receives?${params.toString()}`;
  }, [page]);

  const { data, isLoading, mutate } = useSWR<HriTaskListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });

  const filteredItems = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    const items = data?.items ?? [];
    if (!keyword) return items;
    return items.filter((item) => {
      return (
        item.request_no.toLowerCase().includes(keyword) ||
        item.title.toLowerCase().includes(keyword) ||
        (item.form_name ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [appliedKeyword, data?.items]);

  const rowData = useMemo<ReceiveTaskGridRow[]>(
    () => createReadonlyGridRows(filteredItems.map((item) => ({ ...item, id: item.request_id }))),
    [filteredItems],
  );

  const runAction = useCallback(async (action: "receive-complete" | "receive-reject", requestId: number) => {
    setActingRequestId(requestId);
    setNotice(null);

    try {
      const response = await fetch(`/api/hri/requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() || null }),
      });
      const json = (await response.json().catch(() => null)) as
        | HriRequestActionResponse
        | { detail?: string }
        | null;

      if (!response.ok) {
        throw new Error(json && "detail" in json ? json.detail ?? "수신 처리에 실패했습니다." : "수신 처리에 실패했습니다.");
      }

      setNoticeTone("success");
      setNotice(action === "receive-complete" ? "수신 완료 처리가 반영되었습니다." : "수신 반려 처리가 반영되었습니다.");
      setComment("");
      await mutate();
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "수신 처리에 실패했습니다.");
    } finally {
      setActingRequestId(null);
    }
  }, [comment, mutate]);

  const columnDefs = useMemo<ColDef<ReceiveTaskGridRow>[]>(
    () => [
      { field: "request_no", headerName: "문서번호", width: 150 },
      { field: "form_name", headerName: "신청서 유형", minWidth: 160, flex: 1 },
      { field: "title", headerName: "제목", minWidth: 220, flex: 1.4 },
      {
        field: "status_code",
        headerName: "상태",
        width: 130,
        valueFormatter: (params) => STATUS_LABELS[String(params.value ?? "")] ?? params.value,
      },
      {
        field: "step_type",
        headerName: "현재 단계",
        width: 120,
        valueFormatter: (params) => STEP_TYPE_LABELS[String(params.value ?? "")] ?? params.value,
      },
      { field: "step_order", headerName: "차수", width: 90 },
      {
        field: "requested_at",
        headerName: "요청일",
        width: 120,
        valueFormatter: (params) => String(params.value ?? "").slice(0, 10),
      },
      {
        headerName: "처리",
        width: 190,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data?: ReceiveTaskGridRow }) => {
          if (!params.data) return null;

          const disabled = actingRequestId !== null && actingRequestId === params.data.request_id;
          return (
            <div className="flex h-full items-center gap-1">
              <Button
                size="sm"
                onClick={() => void runAction("receive-complete", params.data!.request_id)}
                disabled={disabled}
              >
                수신 완료
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runAction("receive-reject", params.data!.request_id)}
                disabled={disabled}
              >
                수신 반려
              </Button>
            </div>
          );
        },
      },
    ],
    [actingRequestId, runAction],
  );

  return (
    <ReadonlyGridManager<ReceiveTaskGridRow>
      title="수신함"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-[1fr_1fr]">
          <SearchTextField
            value={keywordInput}
            onChange={setKeywordInput}
            placeholder="문서번호, 제목, 신청서명"
          />
          <div className="flex items-center text-sm text-muted-foreground">
            현재 페이지 기준으로 수신 처리 대기 문서를 빠르게 찾을 수 있습니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        notice ? (
          <Card>
            <CardContent className="py-3">
              <p className={noticeTone === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
                {notice}
              </p>
            </CardContent>
          </Card>
        ) : null
      }
      afterGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground">처리 의견</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="수신 완료 또는 반려 시 남길 의견"
            />
          </CardContent>
        </Card>
      }
      rowData={rowData}
      columnDefs={columnDefs}
      totalCount={appliedKeyword ? filteredItems.length : (data?.total_count ?? 0)}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedKeyword(keywordInput);
        void mutate();
      }}
      queryDisabled={isLoading}
      loading={isLoading}
      emptyText="수신 대기 문서가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
