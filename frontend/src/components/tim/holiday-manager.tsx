"use client";

import { useMemo, useState } from "react";

import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { ensureAgGridRegistered } from "@/lib/ag-grid";

import { Button } from "@/components/ui/button";

ensureAgGridRegistered();

type HolidayRow = {
  id: number;
  year: number;
  month: string;
  day: string;
  name: string;
  type: string;
};

const HOLIDAYS: HolidayRow[] = [
  { id: 1, year: 2026, month: "01월", day: "01일", name: "신정", type: "양력" },
  { id: 2, year: 2026, month: "03월", day: "01일", name: "삼일절", type: "양력" },
  { id: 3, year: 2026, month: "05월", day: "05일", name: "어린이날", type: "양력" },
  { id: 4, year: 2026, month: "06월", day: "06일", name: "현충일", type: "양력" },
  { id: 5, year: 2026, month: "08월", day: "15일", name: "광복절", type: "양력" },
  { id: 6, year: 2026, month: "10월", day: "03일", name: "개천절", type: "양력" },
  { id: 7, year: 2026, month: "10월", day: "09일", name: "한글날", type: "양력" },
  { id: 8, year: 2026, month: "12월", day: "25일", name: "크리스마스", type: "양력" },
];

export function HolidayManager() {
  const [year, setYear] = useState("2026");

  const rowData = useMemo(() => {
    const parsed = Number(year);
    if (Number.isNaN(parsed)) return HOLIDAYS;
    return HOLIDAYS.filter((holiday) => holiday.year === parsed);
  }, [year]);

  const columnDefs = useMemo<ColDef<HolidayRow>[]>(
    () => [
      {
        headerName: "No",
        width: 80,
        sortable: false,
        filter: false,
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      },
      { headerName: "년도", field: "year", width: 100 },
      { headerName: "월", field: "month", width: 100 },
      { headerName: "일", field: "day", width: 100 },
      { headerName: "휴일명", field: "name", flex: 1, minWidth: 180 },
      { headerName: "구분", field: "type", width: 110 },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<HolidayRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    [],
  );

  return (
    <div className="space-y-4 p-6">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">년도</span>
          <input
            className="h-10 w-24 rounded-md border px-3"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
          <Button className="h-10">조회</Button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">휴일관리</h2>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-1 text-sm">입력</button>
            <button className="rounded border px-3 py-1 text-sm">복사</button>
            <button className="rounded border px-3 py-1 text-sm">저장</button>
            <button className="rounded border px-3 py-1 text-sm">다운로드</button>
          </div>
        </div>

        <div className="ag-theme-alpine h-[460px] w-full rounded-md border">
          <AgGridReact<HolidayRow>
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(params) => String(params.data.id)}
            overlayNoRowsTemplate="<span>조회된 휴일이 없습니다.</span>"
          />
        </div>
      </section>
    </div>
  );
}
