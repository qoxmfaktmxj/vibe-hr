"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    <div
      className={cn(
        "flex items-center justify-between border-t border-border bg-card px-3 py-2 md:px-4 md:py-2",
        className,
      )}
    >
      {/* 좌측: 페이지 정보 */}
      <span className="tabular-nums text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{page}</span>
        {" / "}
        <span>{totalPages}</span>
      </span>

      {/* 우측: 컨트롤 */}
      <div className="flex items-center gap-1.5">
        {/* 이전 페이지 */}
        <Button
          size="sm"
          variant="ghost"
          aria-label="이전 페이지"
          disabled={page <= 1 || disabled}
          onClick={goPrev}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={14} />
        </Button>

        {/* 다음 페이지 */}
        <Button
          size="sm"
          variant="ghost"
          aria-label="다음 페이지"
          disabled={page >= totalPages || disabled}
          onClick={goNext}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight size={14} />
        </Button>

        {/* 페이지 직접 이동 */}
        <Input
          value={pageInput}
          onChange={(event) =>
            setPageInput(event.target.value.replace(/[^0-9]/g, ""))
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            goToPage(pageInput);
          }}
          aria-label="이동할 페이지 번호"
          className="h-7 w-14 border-border bg-card px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="페이지"
        />
        <Button
          size="sm"
          variant="outline"
          aria-label="해당 페이지로 이동"
          disabled={disabled}
          onClick={() => goToPage(pageInput)}
          className="h-7 px-2 text-xs"
        >
          이동
        </Button>
      </div>
    </div>
  );
}
