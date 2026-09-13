"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Download, Plus } from "lucide-react";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { HrRetireChecklistItem, HrRetireChecklistListResponse } from "@/types/hr-retire";
import { parseError } from "./hr-retire-shared";

type ChecklistGridRow = HrRetireChecklistItem & ReadonlyGridRow;function toXlsxSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet1";
}

async function downloadRowsAsXlsx<Row extends ReadonlyGridRow>(
  columns: ColDef<Row>[],
  rows: Row[],
  title: string,
  fileName: string,
) {
  const visibleColumns = columns.filter((column) => column.field || column.valueGetter);
  const headers = visibleColumns.map((column) => column.headerName ?? String(column.field ?? ""));
  const data = rows.map((row) =>
    visibleColumns.map((column) => {
      const field = column.field as keyof Row | undefined;
      const rawValue = field ? row[field] : undefined;
      if (typeof column.valueFormatter === "function") {
        return (column.valueFormatter as (params: { value: unknown; data: Row }) => string)({
          value: rawValue,
          data: row,
        }) ?? "";
      }
      return rawValue ?? "";
    }),
  );
  const { utils, writeFileXLSX } = await import("xlsx");
  const sheet = utils.aoa_to_sheet([headers, ...data]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, toXlsxSheetName(title));
  writeFileXLSX(workbook, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function HrRetireChecklistManager() {
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [activeFilterInput, setActiveFilterInput] = useState("all");
  const [appliedActiveFilter, setAppliedActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [newChecklistCode, setNewChecklistCode] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistDescription, setNewChecklistDescription] = useState("");
  const [newChecklistRequired, setNewChecklistRequired] = useState(true);
  const [newChecklistActive, setNewChecklistActive] = useState(true);
  const [newChecklistSortOrder, setNewChecklistSortOrder] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();

  const query = useMemo(() => {
    const params = new URLSearchParams({
      include_inactive: "true",
      page: String(page),
      limit: String(pageSize),
    });
    return `/api/hr/retire/checklist?${params.toString()}`;
  }, [page]);

  const { data, mutate, isLoading } = useSWR<HrRetireChecklistListResponse>(query, fetcher, {
    revalidateOnFocus: false,
  });

  const filteredItems = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return (data?.items ?? []).filter((item) => {
      if (appliedActiveFilter === "active" && !item.is_active) return false;
      if (appliedActiveFilter === "inactive" && item.is_active) return false;
      if (!keyword) return true;
      return (
        item.code.toLowerCase().includes(keyword) ||
        item.title.toLowerCase().includes(keyword) ||
        (item.description ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [appliedActiveFilter, appliedKeyword, data?.items]);

  const rowData = useMemo<ChecklistGridRow[]>(
    () => createReadonlyGridRows(filteredItems),
    [filteredItems],
  );

  async function handleCreateChecklist() {
    if (!newChecklistCode.trim() || !newChecklistTitle.trim()) {
      toast.error("체크리스트 코드와 제목을 입력해 주세요.");
      return;
    }

    const parsedSortOrder = Number(newChecklistSortOrder);
    if (!Number.isFinite(parsedSortOrder)) {
      toast.error("정렬 순서는 숫자로 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/hr/retire/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newChecklistCode.trim().toLowerCase(),
          title: newChecklistTitle.trim(),
          description: newChecklistDescription.trim() || null,
          is_required: newChecklistRequired,
          is_active: newChecklistActive,
          sort_order: parsedSortOrder,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "체크리스트 항목 등록에 실패했습니다."));
      }

      setNewChecklistCode("");
      setNewChecklistTitle("");
      setNewChecklistDescription("");
      setNewChecklistRequired(true);
      setNewChecklistActive(true);
      setNewChecklistSortOrder("0");
      await globalMutate((key) => typeof key === "string" && key.startsWith("/api/hr/retire/checklist"));
      setCreateOpen(false);
      toast.success("체크리스트 항목을 등록했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "체크리스트 항목 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columnDefs = useMemo<ColDef<ChecklistGridRow>[]>(
    () => [
      { field: "code", headerName: "코드", width: 140 },
      { field: "title", headerName: "제목", minWidth: 200, flex: 1 },
      { field: "description", headerName: "설명", minWidth: 220, flex: 1.2 },
      {
        field: "is_required",
        headerName: "필수 여부",
        width: 110,
        valueFormatter: (params) => (params.value ? "필수" : "선택"),
      },
      {
        field: "is_active",
        headerName: "사용 여부",
        width: 110,
        valueFormatter: (params) => (params.value ? "사용" : "중지"),
      },
      { field: "sort_order", headerName: "정렬순서", width: 110 },
    ],
    [],
  );

  return (
    <ReadonlyGridManager<ChecklistGridRow>
      title="퇴직 체크리스트 관리"
      inset gridHeight={420}
      searchFields={
        <SearchFieldGrid className="xl:grid-cols-4">
          <SearchTextField
            className="md:col-span-2"
            value={keywordInput}
            onChange={setKeywordInput}
            placeholder="코드, 제목, 설명"
          />
          <select
            className="h-9 min-w-0 w-full rounded-md border border-border bg-card px-3 text-sm"
            aria-label="사용 여부"
            value={activeFilterInput}
            onChange={(event) => setActiveFilterInput(event.target.value)}
          >
            <option value="all">전체</option>
            <option value="active">사용</option>
            <option value="inactive">중지</option>
          </select>
        </SearchFieldGrid>
      }
      afterGrid={
        <ConfirmDialog open={createOpen} onOpenChange={setCreateOpen} title="체크리스트 항목 등록"
          description="퇴직 처리 시 확인할 항목을 등록합니다." confirmLabel="등록" confirmVariant="save" busy={isSubmitting} onConfirm={handleCreateChecklist}>
          <div className="space-y-3 px-6">
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">코드
              <Input
                aria-label="체크리스트 코드"
                placeholder="코드 예: asset_return"
                value={newChecklistCode}
                onChange={(event) => setNewChecklistCode(event.target.value)}
                disabled={isSubmitting}
              />
              </label>
              <label className="space-y-1 text-sm">제목
              <Input
                aria-label="제목"
                placeholder="제목"
                value={newChecklistTitle}
                onChange={(event) => setNewChecklistTitle(event.target.value)}
                disabled={isSubmitting}
              />
              </label>
              <label className="space-y-1 text-sm">설명
              <Input
                aria-label="설명"
                placeholder="설명"
                value={newChecklistDescription}
                onChange={(event) => setNewChecklistDescription(event.target.value)}
                disabled={isSubmitting}
              />
              </label>
              <label className="space-y-1 text-sm">정렬순서
              <Input
                aria-label="정렬순서"
                type="number"
                placeholder="정렬순서"
                value={newChecklistSortOrder}
                onChange={(event) => setNewChecklistSortOrder(event.target.value)}
                disabled={isSubmitting}
              />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newChecklistRequired}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => setNewChecklistRequired(checked === true)}
                />
                필수 항목
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newChecklistActive}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => setNewChecklistActive(checked === true)}
                />
                사용 항목
              </label>
            </div>
          </div>
        </ConfirmDialog>
      }
      rowData={rowData}
      columnDefs={columnDefs}
      onDownload={() => void downloadRowsAsXlsx(columnDefs, rowData, "퇴직 체크리스트 관리", "hr-retire-checklist")}
      actions={[
        { key: "create", label: "입력", icon: Plus, onClick: () => setCreateOpen(true), disabled: isSubmitting },
        { key: "download", label: "다운로드", icon: Download, onClick: () => void downloadRowsAsXlsx(columnDefs, rowData, "퇴직 체크리스트 관리", "hr-retire-checklist"), disabled: isLoading || rowData.length === 0 },
      ]}
      totalCount={
        appliedKeyword.trim() || appliedActiveFilter !== "all"
          ? filteredItems.length
          : (data?.total_count ?? 0)
      }
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        setAppliedKeyword(keywordInput);
        setAppliedActiveFilter(activeFilterInput);
        void mutate();
      }}
      queryDisabled={isLoading}
      loading={isLoading}
      emptyText="등록된 퇴직 체크리스트가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
