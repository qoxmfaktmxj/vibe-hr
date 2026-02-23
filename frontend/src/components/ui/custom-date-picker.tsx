"use client";

import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";

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

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined;
  const [yy, mm, dd] = value.split("-").map((part) => Number(part));
  if (!yy || !mm || !dd) return undefined;
  const date = new Date(yy, mm - 1, dd);
  if (date.getFullYear() !== yy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return undefined;
  return date;
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

  const selectedDate = useMemo(() => parseDateKey(value), [value]);
  const holidayDates = useMemo(
    () => holidays.map((holiday) => parseDateKey(holiday)).filter(Boolean) as Date[],
    [holidays],
  );

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

  const currentYear = new Date().getFullYear();

  const calendar = (
    <div className="rounded-md border border-slate-200 bg-white p-2 shadow-lg">
      <DayPicker
        mode="single"
        locale={ko}
        captionLayout="dropdown"
        fromYear={currentYear - 10}
        toYear={currentYear + 10}
        selected={selectedDate}
        onSelect={(date) => {
          if (!date) return;
          onChange(toDateKey(date));
          if (!inline && closeOnSelect) setOpen(false);
        }}
        modifiers={{
          holiday: holidayDates,
          weekend: { dayOfWeek: [0, 6] },
        }}
        modifiersClassNames={{
          weekend: "text-red-500",
          holiday:
            "relative text-red-600 after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-red-500",
        }}
        formatters={{
          formatCaption: (date) => format(date, "yyyy년 M월", { locale: ko }),
          formatWeekdayName: (date) => format(date, "EEEEE", { locale: ko }),
        }}
        classNames={{
          months: "flex",
          month: "space-y-2",
          caption: "flex items-center justify-center gap-2 pt-1 relative",
          caption_label: "text-sm font-medium",
          caption_dropdowns: "flex items-center gap-1",
          dropdown: "h-8 rounded border border-slate-200 bg-white px-2 text-xs",
          nav: "flex items-center gap-1",
          nav_button:
            "inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          table: "w-full border-collapse",
          head_row: "flex",
          head_cell: "w-9 text-[0.8rem] font-normal text-slate-500",
          row: "flex w-full mt-1",
          cell: "h-9 w-9 text-center text-sm p-0 relative",
          day: "h-9 w-9 p-0 rounded-md hover:bg-slate-100",
          day_selected: "bg-primary text-white hover:bg-primary/90",
          day_today: "bg-slate-100 font-semibold",
          day_outside: "text-slate-300",
          day_disabled: "text-slate-300",
        }}
      />
    </div>
  );

  if (inline) {
    return <div ref={rootRef}>{calendar}</div>;
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-left text-sm text-slate-700"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{value || placeholder}</span>
        <CalendarDays className="h-4 w-4 text-slate-400" />
      </button>

      {open ? <div className="absolute z-50 mt-2">{calendar}</div> : null}
    </div>
  );
}
