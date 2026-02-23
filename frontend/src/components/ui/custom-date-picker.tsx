"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type CustomDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  holidays?: string[];
  placeholder?: string;
  className?: string;
  closeOnSelect?: boolean;
  inline?: boolean;
};

function pad2(num: number): string {
  return String(num).padStart(2, "0");
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateKey(value: string): Date | null {
  if (!value) return null;
  const [yy, mm, dd] = value.split("-").map((part) => Number(part));
  if (!yy || !mm || !dd) return null;
  const date = new Date(yy, mm - 1, dd);
  if (
    date.getFullYear() !== yy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return null;
  }
  return date;
}

function buildCalendarCells(year: number, month: number): Array<{ day: number; dateKey: string } | null> {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: Array<{ day: number; dateKey: string } | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, dateKey: toDateKey(year, month, day) });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function shiftMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const moved = new Date(year, month - 1 + offset, 1);
  return { year: moved.getFullYear(), month: moved.getMonth() + 1 };
}

export function CustomDatePicker({
  value,
  onChange,
  holidays = [],
  placeholder = "날짜 선택",
  className,
  closeOnSelect = true,
  inline = false,
}: CustomDatePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const selectedDate = parseDateKey(value);
  const initialYear = selectedDate?.getFullYear() ?? today.getFullYear();
  const initialMonth = (selectedDate?.getMonth() ?? today.getMonth()) + 1;
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const cells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);

  useEffect(() => {
    if (!open || inline) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [inline, open]);

  const yearOptions = useMemo(() => {
    const centerYear = today.getFullYear();
    return Array.from({ length: 21 }, (_, i) => centerYear - 10 + i);
  }, [today]);

  function handlePrevMonth() {
    const moved = shiftMonth(viewYear, viewMonth, -1);
    setViewYear(moved.year);
    setViewMonth(moved.month);
  }

  function handleNextMonth() {
    const moved = shiftMonth(viewYear, viewMonth, 1);
    setViewYear(moved.year);
    setViewMonth(moved.month);
  }

  function renderCalendarPanel() {
    return (
      <div className="w-[296px] rounded-md border border-slate-200 bg-white p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="이전 달"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <select
              value={viewYear}
              onChange={(event) => setViewYear(Number(event.target.value))}
              className="h-8 rounded border border-slate-200 px-2 text-xs"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <select
              value={viewMonth}
              onChange={(event) => setViewMonth(Number(event.target.value))}
              className="h-8 rounded border border-slate-200 px-2 text-xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="다음 달"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium">
          <span className="text-red-500">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-red-500">토</span>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="h-9" />;
            }

            const weekday = new Date(viewYear, viewMonth - 1, cell.day).getDay();
            const isWeekend = weekday === 0 || weekday === 6;
            const isHoliday = holidaySet.has(cell.dateKey);
            const isSelected = value === cell.dateKey;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => {
                  onChange(cell.dateKey);
                  if (!inline && closeOnSelect) {
                    setOpen(false);
                  }
                }}
                className={cn(
                  "relative h-9 rounded text-sm transition hover:bg-slate-100",
                  isSelected ? "bg-primary text-white hover:bg-primary/90" : "bg-transparent",
                  !isSelected && (isWeekend || isHoliday) ? "text-red-500" : "text-slate-700",
                )}
              >
                {cell.day}
                {isHoliday && !isSelected ? (
                  <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-red-500" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (inline) {
    return <div ref={rootRef}>{renderCalendarPanel()}</div>;
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-slate-700"
        onClick={() =>
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              const baseDate = parseDateKey(value) ?? today;
              setViewYear(baseDate.getFullYear());
              setViewMonth(baseDate.getMonth() + 1);
            }
            return next;
          })
        }
      >
        <span>{value || placeholder}</span>
        <CalendarDays className="h-4 w-4 text-slate-400" />
      </button>

      {open ? <div className="absolute z-50 mt-1">{renderCalendarPanel()}</div> : null}
    </div>
  );
}
