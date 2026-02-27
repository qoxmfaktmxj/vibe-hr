"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GridPaginationControlsProps = {
  page: number;
  totalPages: number;
  pageInput: string;
  setPageInput: (value: string) => void;
  goPrev: () => void;
  goNext: () => void;
  goToPage: (rawValue: string) => void;
  disabled?: boolean;
  className?: string;
};

export function GridPaginationControls({
  page,
  totalPages,
  pageInput,
  setPageInput,
  goPrev,
  goNext,
  goToPage,
  disabled = false,
  className,
}: GridPaginationControlsProps) {
  return (
    <div className={cn("mt-2 flex items-center justify-end gap-2 text-xs text-slate-500", className)}>
      <Button size="sm" variant="outline" disabled={page <= 1 || disabled} onClick={goPrev}>
        이전
      </Button>
      <span>
        {page}/{totalPages}
      </span>
      <Button size="sm" variant="outline" disabled={page >= totalPages || disabled} onClick={goNext}>
        다음
      </Button>
      <Input
        value={pageInput}
        onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          goToPage(pageInput);
        }}
        className="h-8 w-16"
        placeholder="페이지"
      />
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => goToPage(pageInput)}>
        이동
      </Button>
    </div>
  );
}
