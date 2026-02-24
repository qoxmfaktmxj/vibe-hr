"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmployeeItem } from "@/types/employee";

type Props = {
  selectedEmployee: EmployeeItem | null;
};

type Row = Record<string, string>;

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

export function HrBasicTabs({ selectedEmployee }: Props) {
  const [activeTab, setActiveTab] = useState<
    "basic" | "appointment" | "reward" | "contact" | "career" | "license" | "military" | "evaluation"
  >("basic");

  const basicRows = useMemo(
    () => [
      ["이름", selectedEmployee?.display_name ?? "-"],
      ["사번", selectedEmployee?.employee_no ?? "-"],
      ["성별", "-"],
      ["주민번호", "-"],
      ["입사일", selectedEmployee?.hire_date ?? "-"],
      ["퇴사일", "-"],
      ["혈액형", "-"],
      ["혼인여부", "-"],
      ["MBTI", "-"],
      ["수습해제일", "-"],
    ],
    [selectedEmployee],
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
        <DataTable columns={["일자", "구분", "부서", "직무", "비고"]} rows={[]} emptyMessage="발령 데이터 없음" />
      ) : null}
      {activeTab === "reward" ? (
        <DataTable columns={["일자", "구분(상/벌)", "내역", "비고"]} rows={[]} emptyMessage="상벌 데이터 없음" />
      ) : null}
      {activeTab === "contact" ? (
        <DataTable columns={["구분", "내용", "비고"]} rows={[]} emptyMessage="주소/연락처 데이터 없음" />
      ) : null}
      {activeTab === "career" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>학력</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={["기간", "학교", "전공", "비고"]} rows={[]} emptyMessage="학력 데이터 없음" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>경력</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={["기간", "회사", "직무", "비고"]} rows={[]} emptyMessage="경력 데이터 없음" />
            </CardContent>
          </Card>
        </div>
      ) : null}
      {activeTab === "license" ? (
        <DataTable columns={["취득일", "자격증", "발급기관", "비고"]} rows={[]} emptyMessage="자격증 데이터 없음" />
      ) : null}
      {activeTab === "military" ? (
        <DataTable columns={["복무구분", "군별", "계급", "전역일", "비고"]} rows={[]} emptyMessage="병역 데이터 없음" />
      ) : null}
      {activeTab === "evaluation" ? (
        <DataTable columns={["연도", "평가등급", "최종결과", "비고"]} rows={[]} emptyMessage="평가 데이터 없음" />
      ) : null}
    </div>
  );
}
