"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { HrBasicDetailResponse, HrInfoRow } from "@/types/hr-employee-profile";

type Props = {
  detail: HrBasicDetailResponse | null;
  employeeId: number | null;
  onReload: () => Promise<void>;
};

type TabKey = "basic" | "appointment" | "reward" | "contact" | "education" | "career" | "certificate" | "military" | "evaluation";

function toCategory(tab: Exclude<TabKey, "basic">): string {
  return {
    appointment: "appointment",
    reward: "reward_penalty",
    contact: "contact",
    education: "education",
    career: "career",
    certificate: "certificate",
    military: "military",
    evaluation: "evaluation",
  }[tab];
}

function rowsByTab(detail: HrBasicDetailResponse | null, tab: Exclude<TabKey, "basic">): HrInfoRow[] {
  if (!detail) return [];
  if (tab === "appointment") return detail.appointments;
  if (tab === "reward") return detail.rewards_penalties;
  if (tab === "contact") return detail.contacts;
  if (tab === "education") return detail.educations;
  if (tab === "career") return detail.careers;
  if (tab === "certificate") return detail.certificates;
  if (tab === "military") return detail.military;
  return detail.evaluations;
}

export function HrBasicTabs({ detail, employeeId, onReload }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [newTitle, setNewTitle] = useState("");
  const [draftRows, setDraftRows] = useState<Record<number, HrInfoRow>>({});

  const tabs: Array<[TabKey, string]> = [
    ["basic", "기본"],
    ["appointment", "발령"],
    ["reward", "상벌"],
    ["contact", "주소/연락처"],
    ["education", "학력"],
    ["career", "경력"],
    ["certificate", "자격증"],
    ["military", "병역"],
    ["evaluation", "평가"],
  ];

  const basicRows = useMemo(
    () => [
      ["이름", detail?.profile.full_name ?? "-"],
      ["사번", detail?.profile.employee_no ?? "-"],
      ["성별", detail?.profile.gender ?? "-"],
      ["주민번호", detail?.profile.resident_no_masked ?? "-"],
      ["입사일", detail?.profile.hire_date ?? "-"],
      ["퇴사일", detail?.profile.retire_date ?? "-"],
      ["혈액형", detail?.profile.blood_type ?? "-"],
      ["혼인여부", detail?.profile.marital_status ?? "-"],
      ["MBTI", detail?.profile.mbti ?? "-"],
      ["수습해제일", detail?.profile.probation_end_date ?? "-"],
      ["직군", detail?.profile.job_family ?? "-"],
      ["직무", detail?.profile.job_role ?? "-"],
      ["직급", detail?.profile.grade ?? "-"],
    ],
    [detail],
  );

  const tabRows = activeTab === "basic" ? [] : rowsByTab(detail, activeTab);

  async function addRecord() {
    if (!employeeId || activeTab === "basic") return;
    const response = await fetch(`/api/hr/basic/${employeeId}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: toCategory(activeTab),
        title: newTitle || "신규",
        type: "",
        note: "",
      }),
    });
    if (!response.ok) return toast.error("추가 실패");
    setNewTitle("");
    toast.success("추가 완료");
    await onReload();
  }

  async function saveRow(rowId: number) {
    if (!employeeId) return;
    const row = draftRows[rowId];
    if (!row) return;

    const response = await fetch(`/api/hr/basic/${employeeId}/records/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_date: row.record_date || null,
        type: row.type || null,
        title: row.title || null,
        organization: row.organization || null,
        value: row.value || null,
        note: row.note || null,
      }),
    });
    if (!response.ok) return toast.error("저장 실패");
    toast.success("저장 완료");
    await onReload();
  }

  async function removeRecord(row: HrInfoRow) {
    if (!employeeId) return;
    const response = await fetch(`/api/hr/basic/${employeeId}/records/${row.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("삭제 실패");
    toast.success("삭제 완료");
    await onReload();
  }

  function updateDraft(rowId: number, field: keyof HrInfoRow, value: string) {
    setDraftRows((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value,
      },
    }));
  }

  return (
    <div className="mx-4 mt-4 rounded-xl bg-card p-4 shadow-sm lg:mx-8 lg:p-6">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setActiveTab(value);
              setDraftRows({});
            }}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              activeTab === value ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "basic" ? (
        <Card>
          <CardHeader>
            <CardTitle>인사기본</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {basicRows.map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-800">탭 데이터 관리</CardTitle>
            <div className="mt-2 flex gap-2">
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="신규 항목 제목" className="max-w-xs" />
              <Button onClick={addRecord}>추가</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-slate-700">
                    <th className="px-2 py-2 text-left font-semibold">일자</th>
                    <th className="px-2 py-2 text-left font-semibold">구분</th>
                    <th className="px-2 py-2 text-left font-semibold">제목</th>
                    <th className="px-2 py-2 text-left font-semibold">기관/부서</th>
                    <th className="px-2 py-2 text-left font-semibold">값</th>
                    <th className="px-2 py-2 text-left font-semibold">비고</th>
                    <th className="px-2 py-2 text-left font-semibold">동작</th>
                  </tr>
                </thead>
                <tbody>
                  {tabRows.length === 0 ? (
                    <tr>
                      <td className="px-2 py-6 text-center text-slate-400" colSpan={7}>
                        데이터 없음
                      </td>
                    </tr>
                  ) : (
                    tabRows.map((row) => {
                      const draft = draftRows[row.id] ?? row;
                      return (
                        <tr key={row.id} className="border-t">
                          <td className="px-2 py-1">
                            <Input
                              type="date"
                              value={draft.record_date ?? ""}
                              onChange={(e) => updateDraft(row.id, "record_date", e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.type ?? ""} onChange={(e) => updateDraft(row.id, "type", e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.title ?? ""} onChange={(e) => updateDraft(row.id, "title", e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.organization ?? ""} onChange={(e) => updateDraft(row.id, "organization", e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.value ?? ""} onChange={(e) => updateDraft(row.id, "value", e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={draft.note ?? ""} onChange={(e) => updateDraft(row.id, "note", e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => void saveRow(row.id)}>저장</Button>
                              <Button size="sm" variant="outline" onClick={() => void removeRecord(row)}>
                                삭제
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
