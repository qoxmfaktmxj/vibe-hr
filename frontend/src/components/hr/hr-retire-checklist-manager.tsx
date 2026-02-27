"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { HrRetireChecklistItem, HrRetireChecklistListResponse } from "@/types/hr-retire";
import { parseError } from "./hr-retire-shared";

export function HrRetireChecklistManager() {
  const [newChecklistCode, setNewChecklistCode] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistDescription, setNewChecklistDescription] = useState("");
  const [newChecklistRequired, setNewChecklistRequired] = useState(true);
  const [newChecklistActive, setNewChecklistActive] = useState(true);
  const [newChecklistSortOrder, setNewChecklistSortOrder] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: checklistData, mutate: mutateChecklist } = useSWR<HrRetireChecklistListResponse>(
    "/api/hr/retire/checklist?include_inactive=true",
    fetcher,
    { revalidateOnFocus: false },
  );

  const checklistItems = useMemo(() => checklistData?.items ?? [], [checklistData?.items]);

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
        throw new Error(await parseError(response, "체크리스트 항목 추가에 실패했습니다."));
      }

      setNewChecklistCode("");
      setNewChecklistTitle("");
      setNewChecklistDescription("");
      setNewChecklistRequired(true);
      setNewChecklistActive(true);
      setNewChecklistSortOrder("0");
      await mutateChecklist();
      toast.success("체크리스트 항목이 추가되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "체크리스트 항목 추가에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <Card>
        <CardHeader>
          <CardTitle>퇴직 체크리스트 등록</CardTitle>
          <CardDescription>퇴직 처리 시 사용할 체크리스트 항목을 등록합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="코드 (예: asset_return)"
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
              placeholder="설명 (선택)"
              value={newChecklistDescription}
              onChange={(event) => setNewChecklistDescription(event.target.value)}
              disabled={isSubmitting}
            />
            <Input
              type="number"
              placeholder="정렬 순서"
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
              활성 항목
            </label>
            <Button onClick={handleCreateChecklist} disabled={isSubmitting}>
              항목 추가
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>체크리스트 항목 목록</CardTitle>
          <CardDescription>현재 등록된 퇴직 체크리스트 항목입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {checklistItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 체크리스트 항목이 없습니다.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2">코드</th>
                    <th className="px-3 py-2">제목</th>
                    <th className="px-3 py-2">설명</th>
                    <th className="px-3 py-2">필수</th>
                    <th className="px-3 py-2">활성</th>
                    <th className="px-3 py-2">정렬</th>
                  </tr>
                </thead>
                <tbody>
                  {checklistItems.map((item: HrRetireChecklistItem) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{item.code}</td>
                      <td className="px-3 py-2">{item.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.description ?? "-"}</td>
                      <td className="px-3 py-2">{item.is_required ? "Y" : "N"}</td>
                      <td className="px-3 py-2">{item.is_active ? "Y" : "N"}</td>
                      <td className="px-3 py-2">{item.sort_order}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
