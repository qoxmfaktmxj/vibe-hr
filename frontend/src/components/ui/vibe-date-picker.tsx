"use client";

import { ko } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type VibeDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  holidays?: string[];
  placeholder?: string;
  className?: string;
  closeOnSelect?: boolean;
  inline?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  ariaLabel?: string;
  disabled?: boolean;
};

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }
  return parsed;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatCaption(date: Date): string {
  return `${date.getFullYear()} ${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatWeekdayName(date: Date): string {
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()] ?? "";
}

export function VibeDatePicker({
  value,
  onChange,
  holidays = [],
  placeholder = "날짜 선택",
  className,
  closeOnSelect = true,
  inline = false,
  onKeyDown,
  ariaLabel,
  disabled = false,
}: VibeDatePickerProps) {
  const today = useMemo(() => new Date(), []);
  const selectedDate = useMemo(() => parseDateKey(value), [value]);
  const [viewMonth, setViewMonth] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const month = viewMonth ?? selectedDate ?? today;

  const holidayDates = useMemo(
    () =>
      holidays
        .map((holiday) => parseDateKey(holiday))
        .filter((holiday): holiday is Date => Boolean(holiday)),
    [holidays],
  );

  const calendar = (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg">
      <Calendar
        mode="single"
        month={month}
        onMonthChange={setViewMonth}
        selected={selectedDate}
        onSelect={(date) => {
          if (!date) return;
          setViewMonth(date);
          onChange(formatDateKey(date));
          if (closeOnSelect && !inline) {
            setOpen(false);
          }
        }}
        locale={ko}
        formatters={{
          formatCaption,
          formatWeekdayName,
        }}
        modifiers={{
          weekend: isWeekend,
          holiday: holidayDates,
        }}
        modifiersClassNames={{
          weekend: "text-red-500",
          holiday:
            "text-red-500 after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-red-500 aria-selected:after:bg-primary-foreground",
        }}
      />
    </div>
  );

  if (inline) {
    return calendar;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setViewMonth(selectedDate ?? today)}
          onKeyDown={onKeyDown}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            !value ? "text-muted-foreground" : "text-foreground",
            className,
          )}
        >
          <span>{value || placeholder}</span>
          <CalendarDays className="h-4 w-4 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto border-none bg-transparent p-0 shadow-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {calendar}
      </PopoverContent>
    </Popover>
  );
}
