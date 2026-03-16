"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayPicker,
  getDefaultClassNames,
  type MonthCaptionProps,
  useDayPicker,
} from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

const FALLBACK_START_MONTH = new Date(1950, 0, 1);
const FALLBACK_END_MONTH = new Date(2100, 11, 1);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index,
  label: String(index + 1).padStart(2, "0"),
}));

function CalendarCaption({ calendarMonth, className, ...props }: MonthCaptionProps) {
  const { goToMonth, nextMonth, previousMonth, dayPickerProps } = useDayPicker();

  const displayMonth = calendarMonth.date;
  const currentYear = displayMonth.getFullYear();
  const currentMonth = displayMonth.getMonth();
  const startMonth = dayPickerProps.startMonth ?? FALLBACK_START_MONTH;
  const endMonth = dayPickerProps.endMonth ?? FALLBACK_END_MONTH;

  const years = React.useMemo(() => {
    const startYear = startMonth.getFullYear();
    const endYear = endMonth.getFullYear();
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
  }, [endMonth, startMonth]);

  const monthOptions = React.useMemo(() => {
    const startIndex = currentYear === startMonth.getFullYear() ? startMonth.getMonth() : 0;
    const endIndex = currentYear === endMonth.getFullYear() ? endMonth.getMonth() : 11;
    return MONTH_OPTIONS.filter((month) => month.value >= startIndex && month.value <= endIndex);
  }, [currentYear, endMonth, startMonth]);

  const moveToMonth = (year: number, month: number) => {
    const clampedMonth = Math.min(
      Math.max(month, year === startMonth.getFullYear() ? startMonth.getMonth() : 0),
      year === endMonth.getFullYear() ? endMonth.getMonth() : 11,
    );
    goToMonth(new Date(year, clampedMonth, 1));
  };

  return (
    <div className={cn("flex items-center justify-between gap-2", className)} {...props}>
      <button
        type="button"
        aria-label="Previous month"
        disabled={!previousMonth}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "h-8 w-8 rounded-md border-border bg-background p-0 text-foreground shadow-none hover:bg-accent hover:text-accent-foreground disabled:opacity-40",
        )}
        onClick={() => previousMonth && goToMonth(previousMonth)}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <label className="relative">
          <span className="sr-only">Select year</span>
          <select
            aria-label="Select year"
            className="h-8 min-w-[92px] appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
            value={currentYear}
            onChange={(event) => moveToMonth(Number(event.target.value), currentMonth)}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </label>

        <label className="relative">
          <span className="sr-only">Select month</span>
          <select
            aria-label="Select month"
            className="h-8 min-w-[76px] appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
            value={currentMonth}
            onChange={(event) => moveToMonth(currentYear, Number(event.target.value))}
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </label>
      </div>

      <button
        type="button"
        aria-label="Next month"
        disabled={!nextMonth}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "h-8 w-8 rounded-md border-border bg-background p-0 text-foreground shadow-none hover:bg-accent hover:text-accent-foreground disabled:opacity-40",
        )}
        onClick={() => nextMonth && goToMonth(nextMonth)}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Calendar({ className, classNames, showOutsideDays = false, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      hideNavigation
      startMonth={props.startMonth ?? FALLBACK_START_MONTH}
      endMonth={props.endMonth ?? FALLBACK_END_MONTH}
      className={cn("p-3", className)}
      classNames={{
        root: cn("w-[320px]", defaultClassNames.root),
        months: "flex flex-col",
        month: "space-y-4",
        month_caption: "flex items-center justify-between gap-2 pt-1",
        caption_label: "text-sm font-medium text-foreground",
        nav: "hidden",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "pointer-events-auto h-8 w-8 rounded-md border-border bg-background p-0 text-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "pointer-events-auto h-8 w-8 rounded-md border-border bg-background p-0 text-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7",
        weekday: "h-8 text-center text-xs font-medium text-slate-500",
        week: "mt-1 grid grid-cols-7 gap-1",
        day: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "relative h-9 w-9 rounded-md p-0 font-normal text-foreground aria-selected:opacity-100",
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "font-semibold text-foreground",
        outside: "text-muted-foreground opacity-40",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        chevron: "h-4 w-4",
        ...classNames,
      }}
      components={{
        MonthCaption: CalendarCaption,
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
