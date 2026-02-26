"use client";

import { cn } from "@/lib/utils";
import type { GridStatusSummary } from "@/lib/grid/grid-status";

type GridChangeSummaryBadgesProps = {
  summary: GridStatusSummary;
  className?: string;
};

export function GridChangeSummaryBadges({ summary, className }: GridChangeSummaryBadgesProps) {
  if (summary.added + summary.updated + summary.deleted === 0) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {summary.added > 0 && (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          +{summary.added}
        </span>
      )}
      {summary.updated > 0 && (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          ~{summary.updated}
        </span>
      )}
      {summary.deleted > 0 && (
        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          -{summary.deleted}
        </span>
      )}
    </div>
  );
}
