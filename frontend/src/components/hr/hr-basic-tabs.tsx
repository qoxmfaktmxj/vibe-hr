"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HrBasicDetailResponse } from "@/types/hr-employee-profile";

type Props = {
  detail: HrBasicDetailResponse | null;
};

type Row = Record<string, string>;

function mapRows(items: Array<{ record_date?: string | null; type?: string | null; title?: string | null; organization?: string | null; value?: string | null; note?: string | null }>, columns: string[]): Row[] {
  return items.map((item) => {
    const row: Row = {};
    for (const column of columns) row[column] = "-";
    if (columns.includes("일자")) row["일자"] = item.record_date ?? "-";
    if (columns.includes("구분")) row["구분"] = item.type ?? "-";
    if (columns.includes("구분(상/벌)")) row["구분(상/벌)"] = item.type ?? "-";
    if (columns.includes("부서")) row["부서"] = item.organization ?? "-";
    if (columns.includes("직무")) row["직무"] = item.value ?? "-";
    if (columns.includes("내역")) row["내역"] = item.title ?? "-";
    if (columns.includes("내용")) row["내용"] = item.value ?? item.title ?? "-";
    if (columns.includes("기간")) row["기간"] = item.record_date ?? "-";
    if (columns.includes("학교")) row["학교"] = item.organization ?? "-";
    if (columns.includes("전공")) row["전공"] = item.value ?? "-";
    if (columns.includes("회사")) row["회사"] = item.organization ?? "-";
    if (columns.includes("자격증")) row["자격증"] = item.title ?? "-";
    if (columns.includes("취득일")) row["취득일"] = item.record_date ?? "-";
    if (columns.includes("발급기관")) row["발급기관"] = item.organization ?? "-";
    if (columns.includes("복무구분")) row["복무구분"] = item.type ?? "-";
    if (columns.includes("군별")) row["군별"] = item.organization ?? "-";
    if (columns.includes("계급")) row["계급"] = item.value ?? "-";
    if (columns.includes("전역일")) row["전역일"] = item.record_date ?? "-";
    if (columns.includes("연도")) row["연도"] = item.record_date?.slice(0, 4) ?? "-";
    if (columns.includes("평가등급")) row["평가등급"] = item.type ?? "-";
    if (columns.includes("최종결과")) row["최종결과"] = item.value ?? "-";
    if (columns.includes("비고")) row["비고"] = item.note ?? "-";
    return row;
  });
}

function DataTable({ columns, rows, emptyMessage }: { columns: string[]; rows: Row[]; emptyMessage: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t">
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2">
                    {row[column] ?? "-"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HrBasicTabs({ detail }: Props) {
  const [activeTab, setActiveTab] = useState<
    "basic" | "appointment" | "reward" | "contact" | "career" | "license" | "military" | "evaluation"
  >("basic");

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
    ],
    [detail],
  );

  const tabs = [
    ["basic", "기본"],
    ["appointment", "발령"],
    ["reward", "상벌"],
    ["contact", "주소/연락처"],
    ["career", "학력/경력"],
    ["license", "자격증"],
    ["military", "병역"],
    ["evaluation", "평가"],
  ] as const;

  return (
    <div className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm lg:mx-8 lg:p-6">
      <div className="mb-4 flex w-full flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              activeTab === value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-slate-200 bg-white text-slate-600"
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
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "appointment" ? (
        <DataTable
          columns={["일자", "구분", "부서", "직무", "비고"]}
          rows={mapRows(detail?.appointments ?? [], ["일자", "구분", "부서", "직무", "비고"]) }
          emptyMessage="발령 데이터 없음"
        />
      ) : null}
      {activeTab === "reward" ? (
        <DataTable
          columns={["일자", "구분(상/벌)", "내역", "비고"]}
          rows={mapRows(detail?.rewards_penalties ?? [], ["일자", "구분(상/벌)", "내역", "비고"]) }
          emptyMessage="상벌 데이터 없음"
        />
      ) : null}
      {activeTab === "contact" ? (
        <DataTable
          columns={["구분", "내용", "비고"]}
          rows={mapRows(detail?.contacts ?? [], ["구분", "내용", "비고"]) }
          emptyMessage="주소/연락처 데이터 없음"
        />
      ) : null}
      {activeTab === "career" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>학력</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={["기간", "학교", "전공", "비고"]}
                rows={mapRows(detail?.educations ?? [], ["기간", "학교", "전공", "비고"]) }
                emptyMessage="학력 데이터 없음"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>경력</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={["기간", "회사", "직무", "비고"]}
                rows={mapRows(detail?.careers ?? [], ["기간", "회사", "직무", "비고"]) }
                emptyMessage="경력 데이터 없음"
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
      {activeTab === "license" ? (
        <DataTable
          columns={["취득일", "자격증", "발급기관", "비고"]}
          rows={mapRows(detail?.certificates ?? [], ["취득일", "자격증", "발급기관", "비고"]) }
          emptyMessage="자격증 데이터 없음"
        />
      ) : null}
      {activeTab === "military" ? (
        <DataTable
          columns={["복무구분", "군별", "계급", "전역일", "비고"]}
          rows={mapRows(detail?.military ?? [], ["복무구분", "군별", "계급", "전역일", "비고"]) }
          emptyMessage="병역 데이터 없음"
        />
      ) : null}
      {activeTab === "evaluation" ? (
        <DataTable
          columns={["연도", "평가등급", "최종결과", "비고"]}
          rows={mapRows(detail?.evaluations ?? [], ["연도", "평가등급", "최종결과", "비고"]) }
          emptyMessage="평가 데이터 없음"
        />
      ) : null}
    </div>
  );
}
