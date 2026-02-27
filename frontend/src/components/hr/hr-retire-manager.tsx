"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { EmployeeListResponse } from "@/types/employee";
import type {
  HrRetireCaseDetail,
  HrRetireCaseListResponse,
  HrRetireChecklistItem,
  HrRetireChecklistListResponse,
} from "@/types/hr-retire";

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "detail" in value) {
    const detail = (value as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown;
  return toErrorMessage(payload, fallback);
}

function statusLabel(status: HrRetireCaseDetail["status"] | string): string {
  if (status === "draft") return "진행중";
  if (status === "confirmed") return "확정";
  if (status === "cancelled") return "취소";
  return status;
}

export function HrRetireManager() {
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [newEmployeeId, setNewEmployeeId] = useState<string>("");
  const [newRetireDate, setNewRetireDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newReason, setNewReason] = useState<string>("");

  const [newChecklistCode, setNewChecklistCode] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistRequired, setNewChecklistRequired] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const { data: employeeData } = useSWR<EmployeeListResponse>("/api/employees?all=true", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: checklistData, mutate: mutateChecklist } = useSWR<HrRetireChecklistListResponse>(
    "/api/hr/retire/checklist?include_inactive=true",
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: caseData, mutate: mutateCases } = useSWR<HrRetireCaseListResponse>(
    "/api/hr/retire/cases",
    fetcher,
    { revalidateOnFocus: false },
  );

  const detailKey = selectedCaseId ? `/api/hr/retire/cases/${selectedCaseId}` : null;
  const { data: caseDetail, mutate: mutateCaseDetail } = useSWR<HrRetireCaseDetail>(detailKey, fetcher, {
    revalidateOnFocus: false,
  });

  const employees = useMemo(
    () => (employeeData?.employees ?? []).filter((row) => row.employment_status !== "resigned"),
    [employeeData?.employees],
  );
  const checklistItems = checklistData?.items ?? [];
  const caseItems = caseData?.items ?? [];
  const firstCaseId = caseData?.items?.[0]?.id ?? null;

  useEffect(() => {
    if (selectedCaseId || !firstCaseId) return;
    setSelectedCaseId(firstCaseId);
  }, [firstCaseId, selectedCaseId]);

  useEffect(() => {
    if (!caseDetail) {
      setNoteDrafts({});
      return;
    }
    const next: Record<number, string> = {};
    for (const item of caseDetail.checklist_items) {
      next[item.id] = item.note ?? "";
    }
    setNoteDrafts(next);
  }, [caseDetail]);

  async function handleCreateChecklist() {
    if (!newChecklistCode.trim() || !newChecklistTitle.trim()) {
      toast.error("체크리스트 코드/제목을 입력해 주세요.");
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
          is_required: newChecklistRequired,
          is_active: true,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "체크리스트 추가에 실패했습니다."));
      }
      setNewChecklistCode("");
      setNewChecklistTitle("");
      setNewChecklistRequired(true);
      await mutateChecklist();
      toast.success("체크리스트 항목이 추가되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "체크리스트 추가에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateCase() {
    if (!newEmployeeId || !newRetireDate) {
      toast.error("대상자와 퇴직일을 선택해 주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/hr/retire/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(newEmployeeId),
          retire_date: newRetireDate,
          reason: newReason.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "퇴직 건 생성에 실패했습니다."));
      }

      const created = (await response.json()) as HrRetireCaseDetail;
      setSelectedCaseId(created.id);
      setNewReason("");
      await mutateCases();
      await mutateCaseDetail();
      toast.success("퇴직 처리 건이 생성되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "퇴직 건 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateCaseItem(itemId: number, isChecked: boolean, note: string) {
    if (!caseDetail) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/hr/retire/cases/${caseDetail.id}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_checked: isChecked, note: note || null }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "체크리스트 업데이트에 실패했습니다."));
      }
      const updated = (await response.json()) as HrRetireCaseDetail;
      await mutateCaseDetail(updated, { revalidate: false });
      await mutateCases();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "체크리스트 업데이트에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmCase() {
    if (!caseDetail) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/hr/retire/cases/${caseDetail.id}/confirm`, { method: "POST" });
      if (!response.ok) {
        throw new Error(await parseError(response, "퇴직 확정에 실패했습니다."));
      }
      const updated = (await response.json()) as HrRetireCaseDetail;
      await mutateCaseDetail(updated, { revalidate: false });
      await mutateCases();
      toast.success("퇴직 처리가 확정되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "퇴직 확정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelCase() {
    if (!caseDetail) return;
    const reason = window.prompt("취소 사유를 입력해 주세요.", caseDetail.cancel_reason ?? "");
    if (reason === null) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/hr/retire/cases/${caseDetail.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_reason: reason.trim() || null }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "퇴직 취소에 실패했습니다."));
      }
      const updated = (await response.json()) as HrRetireCaseDetail;
      await mutateCaseDetail(updated, { revalidate: false });
      await mutateCases();
      toast.success("퇴직 처리가 취소되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "퇴직 취소에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <Card>
        <CardHeader>
          <CardTitle>퇴직 처리 생성</CardTitle>
          <CardDescription>대상자 선택 후 퇴직 처리 케이스를 생성합니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select
            className="h-9 rounded-md border px-3 text-sm"
            value={newEmployeeId}
            onChange={(event) => setNewEmployeeId(event.target.value)}
            disabled={isSubmitting}
          >
            <option value="">대상자 선택</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employee_no} | {employee.display_name} | {employee.department_name}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={newRetireDate}
            onChange={(event) => setNewRetireDate(event.target.value)}
            disabled={isSubmitting}
          />
          <Input
            placeholder="사유(선택)"
            value={newReason}
            onChange={(event) => setNewReason(event.target.value)}
            disabled={isSubmitting}
          />
          <Button onClick={handleCreateCase} disabled={isSubmitting}>
            퇴직 건 생성
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>퇴직 케이스 목록</CardTitle>
            <CardDescription>생성된 퇴직 처리 목록</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {caseItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 퇴직 케이스가 없습니다.</p>
            ) : (
              caseItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left text-sm ${
                    selectedCaseId === item.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onClick={() => setSelectedCaseId(item.id)}
                >
                  <div className="font-medium">
                    {item.employee_name} ({item.employee_no})
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.department_name} | {item.retire_date}
                  </div>
                  <div className="mt-1 text-xs">상태: {statusLabel(item.status)}</div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>퇴직 체크리스트</CardTitle>
            <CardDescription>체크 완료 후 퇴직 확정 또는 취소를 수행합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {!caseDetail ? (
              <p className="text-sm text-muted-foreground">좌측에서 퇴직 케이스를 선택해 주세요.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border p-3 text-sm">
                  <div className="font-medium">
                    {caseDetail.employee_name} ({caseDetail.employee_no})
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {caseDetail.department_name} | {caseDetail.position_title}
                  </div>
                  <div className="mt-1">
                    퇴직일: {caseDetail.retire_date} | 상태: {statusLabel(caseDetail.status)}
                  </div>
                </div>

                <div className="space-y-2">
                  {caseDetail.checklist_items.map((item) => (
                    <div key={item.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox
                            checked={item.is_checked}
                            disabled={isSubmitting || caseDetail.status !== "draft"}
                            onCheckedChange={(checked) => {
                              const next = checked === true;
                              void updateCaseItem(item.id, next, noteDrafts[item.id] ?? "");
                            }}
                          />
                          {item.checklist_title}
                          {item.is_required ? <span className="text-xs text-red-600">(필수)</span> : null}
                        </label>
                      </div>
                      {item.checklist_description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{item.checklist_description}</p>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        <Input
                          placeholder="비고"
                          value={noteDrafts[item.id] ?? ""}
                          onChange={(event) =>
                            setNoteDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                          }
                          disabled={isSubmitting || caseDetail.status !== "draft"}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isSubmitting || caseDetail.status !== "draft"}
                          onClick={() =>
                            void updateCaseItem(item.id, item.is_checked, noteDrafts[item.id] ?? "")
                          }
                        >
                          메모 저장
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleConfirmCase}
                    disabled={isSubmitting || caseDetail.status !== "draft"}
                  >
                    퇴직 확정
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleCancelCase}
                    disabled={isSubmitting || caseDetail.status !== "confirmed"}
                  >
                    퇴직 취소
                  </Button>
                </div>

                <div className="rounded-md border p-3">
                  <h3 className="text-sm font-semibold">처리 로그</h3>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {caseDetail.audit_logs.length === 0 ? (
                      <p>로그가 없습니다.</p>
                    ) : (
                      caseDetail.audit_logs.map((log) => (
                        <p key={log.id}>
                          [{new Date(log.created_at).toLocaleString("ko-KR")}] {log.action_type}
                          {log.detail ? ` - ${log.detail}` : ""}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>체크리스트 마스터</CardTitle>
          <CardDescription>퇴직 체크리스트 항목을 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="코드 (예: asset_return)"
              value={newChecklistCode}
              onChange={(event) => setNewChecklistCode(event.target.value)}
              disabled={isSubmitting}
            />
            <Input
              placeholder="항목명"
              value={newChecklistTitle}
              onChange={(event) => setNewChecklistTitle(event.target.value)}
              disabled={isSubmitting}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={newChecklistRequired}
                disabled={isSubmitting}
                onCheckedChange={(checked) => setNewChecklistRequired(checked === true)}
              />
              필수 항목
            </label>
            <Button onClick={handleCreateChecklist} disabled={isSubmitting}>
              항목 추가
            </Button>
          </div>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">코드</th>
                  <th className="px-3 py-2">항목명</th>
                  <th className="px-3 py-2">필수</th>
                  <th className="px-3 py-2">활성</th>
                </tr>
              </thead>
              <tbody>
                {checklistItems.map((item: HrRetireChecklistItem) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">{item.code}</td>
                    <td className="px-3 py-2">{item.title}</td>
                    <td className="px-3 py-2">{item.is_required ? "Y" : "N"}</td>
                    <td className="px-3 py-2">{item.is_active ? "Y" : "N"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
