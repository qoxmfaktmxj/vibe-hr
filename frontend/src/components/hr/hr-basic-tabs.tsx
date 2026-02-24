"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleRegistry, AllCommunityModule, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { HrBasicDetailResponse, HrInfoRow } from "@/types/hr-employee-profile";

let registered = false;
if (!registered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  registered = true;
}

type Props = {
  detail: HrBasicDetailResponse | null;
  employeeId: number | null;
  onReload: () => Promise<void>;
};

function categoryFromTab(tab: string): string {
  switch (tab) {
    case "appointment": return "appointment";
    case "reward": return "reward_penalty";
    case "contact": return "contact";
    case "education": return "education";
    case "career": return "career";
    case "certificate": return "certificate";
    case "military": return "military";
    default: return "evaluation";
  }
}

export function HrBasicTabs({ detail, employeeId, onReload }: Props) {
  const [activeTab, setActiveTab] = useState<
    "basic" | "appointment" | "reward" | "contact" | "education" | "career" | "certificate" | "military" | "evaluation"
  >("basic");

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    gender: "",
    resident_no_masked: "",
    hire_date: "",
    retire_date: "",
    blood_type: "",
    marital_status: "",
    mbti: "",
    probation_end_date: "",
    job_family: "",
    job_role: "",
    grade: "",
    position_title: "",
  });

  useEffect(() => {
    setProfileForm({
      full_name: detail?.profile.full_name ?? "",
      gender: detail?.profile.gender ?? "",
      resident_no_masked: detail?.profile.resident_no_masked ?? "",
      hire_date: detail?.profile.hire_date ?? "",
      retire_date: detail?.profile.retire_date ?? "",
      blood_type: detail?.profile.blood_type ?? "",
      marital_status: detail?.profile.marital_status ?? "",
      mbti: detail?.profile.mbti ?? "",
      probation_end_date: detail?.profile.probation_end_date ?? "",
      job_family: detail?.profile.job_family ?? "",
      job_role: detail?.profile.job_role ?? "",
      grade: detail?.profile.grade ?? "",
      position_title: detail?.profile.position_title ?? "",
    });
  }, [detail]);

  const tabs = [
    ["basic", "기본"],
    ["appointment", "발령"],
    ["reward", "상벌"],
    ["contact", "주소/연락처"],
    ["education", "학력"],
    ["career", "경력"],
    ["certificate", "자격증"],
    ["military", "병역"],
    ["evaluation", "평가"],
  ] as const;

  const rowMap = useMemo(() => ({
    appointment: detail?.appointments ?? [],
    reward: detail?.rewards_penalties ?? [],
    contact: detail?.contacts ?? [],
    education: detail?.educations ?? [],
    career: detail?.careers ?? [],
    certificate: detail?.certificates ?? [],
    military: detail?.military ?? [],
    evaluation: detail?.evaluations ?? [],
  }), [detail]);

  const columns: ColDef<HrInfoRow>[] = [
    { field: "record_date", headerName: "일자", editable: true, flex: 1, minWidth: 120 },
    { field: "type", headerName: "구분", editable: true, flex: 1, minWidth: 120 },
    { field: "title", headerName: "제목", editable: true, flex: 1, minWidth: 140 },
    { field: "organization", headerName: "기관/부서", editable: true, flex: 1, minWidth: 140 },
    { field: "value", headerName: "값", editable: true, flex: 1, minWidth: 140 },
    { field: "note", headerName: "비고", editable: true, flex: 1, minWidth: 160 },
  ];

  async function saveProfile() {
    if (!employeeId) return;
    const response = await fetch(`/api/hr/basic/${employeeId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    if (!response.ok) return toast.error("프로필 저장 실패");
    toast.success("프로필 저장 완료");
    await onReload();
  }

  async function addRow() {
    if (!employeeId || activeTab === "basic") return;
    const response = await fetch(`/api/hr/basic/${employeeId}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: categoryFromTab(activeTab), title: "신규", type: "", note: "" }),
    });
    if (!response.ok) return toast.error("행 추가 실패");
    toast.success("행 추가 완료");
    await onReload();
  }

  async function saveRow(row: HrInfoRow) {
    if (!employeeId) return;
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
    if (!response.ok) return toast.error("행 저장 실패");
    toast.success("행 저장 완료");
    await onReload();
  }

  async function deleteRow(row: HrInfoRow) {
    if (!employeeId) return;
    const response = await fetch(`/api/hr/basic/${employeeId}/records/${row.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("행 삭제 실패");
    toast.success("행 삭제 완료");
    await onReload();
  }

  const currentRows = activeTab === "basic" ? [] : rowMap[activeTab];

  return (
    <div className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm lg:mx-8 lg:p-6">
      <div className="mb-4 flex w-full flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setActiveTab(value)} className={`rounded-md border px-3 py-1.5 text-sm ${activeTab === value ? "border-primary/40 bg-primary/10 text-primary" : "border-slate-200 bg-white text-slate-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "basic" ? (
        <Card>
          <CardHeader><CardTitle>인사기본 (CRUD)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {Object.entries(profileForm).map(([k, v]) => (
                <Input key={k} value={v} onChange={(e) => setProfileForm((p) => ({ ...p, [k]: e.target.value }))} placeholder={k} />
              ))}
            </div>
            <div className="mt-3"><Button onClick={saveProfile}>기본정보 저장</Button></div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2"><Button onClick={addRow}>행 추가</Button></div>
          <div className="ag-theme-quartz" style={{ height: 420 }}>
            <AgGridReact<HrInfoRow>
              rowData={currentRows}
              columnDefs={columns}
              getRowId={(params) => String(params.data.id)}
              onCellValueChanged={(event) => {
                if (!event.data) return;
                void saveRow(event.data);
              }}
              rowSelection={{ mode: "singleRow" }}
              onRowDoubleClicked={(event) => {
                if (!event.data) return;
                if (confirm("이 행을 삭제할까요?")) void deleteRow(event.data);
              }}
            />
          </div>
          <p className="text-xs text-slate-500">행 더블클릭: 삭제 / 셀 수정 시 자동 저장</p>
        </div>
      )}
    </div>
  );
}
