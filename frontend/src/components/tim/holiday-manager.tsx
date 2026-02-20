"use client";

import { useMemo, useState } from "react";

import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Button } from "@/components/ui/button";
import { HOLIDAY_ROWS } from "@/lib/holiday-data";

function isWeekend(dateKey: string): boolean {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

export function HolidayManager() {
  const [yearFilter, setYearFilter] = useState("2026");
  const [referenceDate, setReferenceDate] = useState("");

  const filteredRows = useMemo(() => {
    const year = Number(yearFilter);
    const byYear = Number.isFinite(year)
      ? HOLIDAY_ROWS.filter((row) => row.year === year)
      : HOLIDAY_ROWS;

    if (!referenceDate) return byYear;
    return byYear.filter((row) => row.date_key === referenceDate);
  }, [referenceDate, yearFilter]);

  const holidayDateKeys = useMemo(() => {
    const year = Number(yearFilter);
    if (!Number.isFinite(year)) return HOLIDAY_ROWS.map((row) => row.date_key);
    return HOLIDAY_ROWS.filter((row) => row.year === year).map((row) => row.date_key);
  }, [yearFilter]);

  return (
    <div className="space-y-4 p-6">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-xs text-gray-600">년도</span>
            <input
              className="h-9 w-24 rounded-md border border-gray-200 px-3 text-sm"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-600">기준일자</span>
            <CustomDatePicker
              className="w-40"
              value={referenceDate}
              onChange={setReferenceDate}
              holidays={holidayDateKeys}
            />
          </div>
          <Button variant="query" className="h-9 px-4">조회</Button>
          {referenceDate ? (
            <Button variant="outline" className="h-9 px-4" onClick={() => setReferenceDate("")}>
              기준일자 초기화
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">휴일관리</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">입력</Button>
            <Button variant="outline" size="sm">복사</Button>
            <Button variant="save" size="sm">저장</Button>
            <Button variant="outline" size="sm">다운로드</Button>
          </div>
        </div>

        <div className="mb-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          안내: 커스텀 달력에서 휴일/토요일/일요일은 빨간색으로 표시됩니다.
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border px-2 py-2">No</th>
                <th className="border px-2 py-2">년도</th>
                <th className="border px-2 py-2">월</th>
                <th className="border px-2 py-2">일</th>
                <th className="border px-2 py-2">휴일명</th>
                <th className="border px-2 py-2">구분</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((holiday) => (
                <tr key={holiday.no} className="odd:bg-white even:bg-slate-50">
                  <td className="border px-2 py-2 text-center">{holiday.no}</td>
                  <td className="border px-2 py-2 text-center">{holiday.year}</td>
                  <td className="border px-2 py-2 text-center">{holiday.month}</td>
                  <td
                    className={`border px-2 py-2 text-center ${
                      isWeekend(holiday.date_key) ? "text-red-500 font-medium" : ""
                    }`}
                  >
                    {holiday.day}
                  </td>
                  <td className="border px-2 py-2">{holiday.name}</td>
                  <td className="border px-2 py-2 text-center">{holiday.type}</td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="border px-2 py-8 text-center text-slate-500" colSpan={6}>
                    조회된 휴일이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
