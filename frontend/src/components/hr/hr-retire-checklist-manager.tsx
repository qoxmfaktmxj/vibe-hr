"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { useSWRConfig } from "swr";
import { toast } from "sonner";

import { VibeGrid } from "@/components/grid/vibe-grid";
import type { ReadonlyGridRow } from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid, SearchTextField } from "@/components/grid/search-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { HrRetireChecklistItem } from "@/types/hr-retire";
import { parseError } from "./hr-retire-shared";

const BASE_URL = "/api/hr/retire/checklist";

type ChecklistGridRow = HrRetireChecklistItem & ReadonlyGridRow;

export function HrRetireChecklistManager() {
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [activeFilterInput, setActiveFilterInput] = useState("all");
  const [appliedActiveFilter, setAppliedActiveFilter] = useState("all");

  const [newChecklistCode, setNewChecklistCode] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistDescription, setNewChecklistDescription] = useState("");
  const [newChecklistRequired, setNewChecklistRequired] = useState(true);
  const [newChecklistActive, setNewChecklistActive] = useState(true);
  const [newChecklistSortOrder, setNewChecklistSortOrder] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mutate: globalMutate } = useSWRConfig();

  async function refreshList() {
    await globalMutate((key) => typeof key === "string" && key.startsWith(BASE_URL));
  }

  // Client-side filter applied after fetch (same as before: only the current
  // page's fetched rows are searched/filtered, not the full server-side set).
  const transformRows = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return (rows: ChecklistGridRow[]) =>
      rows.filter((row) => {
        if (appliedActiveFilter === "active" && !row.is_active) return false;
        if (appliedActiveFilter === "inactive" && row.is_active) return false;
        if (!keyword) return true;
        return (
          row.code.toLowerCase().includes(keyword) ||
          row.title.toLowerCase().includes(keyword) ||
          (row.description ?? "").toLowerCase().includes(keyword)
        );
      });
  }, [appliedActiveFilter, appliedKeyword]);

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
      const response = await fetch(BASE_URL, {
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
      await refreshList();
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
    <VibeGrid<HrRetireChecklistItem>
      registryKey="hr.retire.checklist"
      title="퇴직 체크리스트 관리"
      variant="readonly"
      columns={columnDefs}
      fetchUrl={`${BASE_URL}?include_inactive=true`}
      transformRows={transformRows}
      pageSize={50}
      downloadFileName="hr-retire-checklist"
      emptyText="등록된 퇴직 체크리스트가 없습니다."
      onQueryStart={() => {
        setAppliedKeyword(keywordInput);
        setAppliedActiveFilter(activeFilterInput);
      }}
      searchFields={
        <SearchFieldGrid className="md:grid-cols-[1fr_160px]">
          <SearchTextField
            value={keywordInput}
            onChange={setKeywordInput}
            placeholder="코드, 제목, 설명"
          />
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            value={activeFilterInput}
            onChange={(event) => setActiveFilterInput(event.target.value)}
          >
            <option value="all">전체</option>
            <option value="active">사용</option>
            <option value="inactive">중지</option>
          </select>
        </SearchFieldGrid>
      }
      beforeGrid={
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground">체크리스트 항목 등록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <Input
                placeholder="코드 예: asset_return"
                value={newChecklistCode}
                onChange={(event) => setNewChecklistCode(event.target.value)}
                disabled={isSubmitting}
              />
              <Input
                placeholder="제목"
                value={newChecklistTitle}
                onChange={(event) => setNewChecklistTitle(event.target.value)}
                disabled={isSubmitting}
              />
              <Input
                placeholder="설명"
                value={newChecklistDescription}
                onChange={(event) => setNewChecklistDescription(event.target.value)}
                disabled={isSubmitting}
              />
              <Input
                type="number"
                placeholder="정렬순서"
                value={newChecklistSortOrder}
                onChange={(event) => setNewChecklistSortOrder(event.target.value)}
                disabled={isSubmitting}
              />
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
              <Button onClick={() => void handleCreateChecklist()} disabled={isSubmitting}>
                등록
              </Button>
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}
