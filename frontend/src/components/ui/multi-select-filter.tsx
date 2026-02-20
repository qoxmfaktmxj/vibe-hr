"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type MultiSelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type MultiSelectFilterProps<T extends string = string> = {
  options: MultiSelectOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
};

export function MultiSelectFilter<T extends string = string>({
  options,
  values,
  onChange,
  placeholder = "전체",
  searchPlaceholder = "검색",
  className,
}: MultiSelectFilterProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const valueSet = useMemo(() => new Set(values), [values]);
  const filteredOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [options, query]);

  const summaryLabel = useMemo(() => {
    if (values.length === 0) return placeholder;
    return `${values.length}개 선택`;
  }, [placeholder, values.length]);

  function toggleOption(value: T) {
    const next = new Set(valueSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(Array.from(next));
  }

  function selectAllFiltered() {
    const next = new Set(valueSet);
    for (const option of filteredOptions) {
      next.add(option.value);
    }
    onChange(Array.from(next));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 w-full justify-between px-3 text-left text-sm font-normal", className)}
        >
          <span className="truncate">{summaryLabel}</span>
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[280px] p-2"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="mb-2 flex items-center gap-2 rounded-md border border-slate-200 px-2">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={searchPlaceholder}
            className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <Button type="button" size="xs" variant="outline" onClick={selectAllFiltered}>
            전체 선택
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={clearAll}>
            전체 해제
          </Button>
        </div>

        <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-500">검색 결과가 없습니다.</div>
          ) : (
            filteredOptions.map((option) => {
              const checked = valueSet.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                  onClick={() => toggleOption(option.value)}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      checked
                        ? "border-[var(--vibe-primary)] bg-[var(--vibe-primary)] text-white"
                        : "border-slate-300 bg-white text-transparent",
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
