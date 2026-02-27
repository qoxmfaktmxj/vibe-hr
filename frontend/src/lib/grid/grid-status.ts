export type GridStatus = "clean" | "added" | "updated" | "deleted";

export type GridStatusSummary = {
  added: number;
  updated: number;
  deleted: number;
};

type RowClassRuleParams<T> = {
  data?: T | null;
};

export type GridRowClassRules<T> = {
  [className: string]: (params: RowClassRuleParams<T>) => boolean;
};

export function summarizeGridStatuses<T>(
  rows: readonly T[],
  getStatus: (row: T) => GridStatus,
): GridStatusSummary {
  const summary: GridStatusSummary = { added: 0, updated: 0, deleted: 0 };
  for (const row of rows) {
    const status = getStatus(row);
    if (status === "added") summary.added += 1;
    else if (status === "updated") summary.updated += 1;
    else if (status === "deleted") summary.deleted += 1;
  }
  return summary;
}

export function getGridStatusCellClass(status?: GridStatus): string {
  if (status === "added") return "vibe-status-added";
  if (status === "updated") return "vibe-status-updated";
  if (status === "deleted") return "vibe-status-deleted";
  return "";
}

export function getGridRowClass(status?: GridStatus): string {
  if (status === "added") return "vibe-row-added";
  if (status === "updated") return "vibe-row-updated";
  if (status === "deleted") return "vibe-row-deleted";
  return "";
}

export function buildGridRowClassRules<T extends { _status?: GridStatus }>() : GridRowClassRules<T> {
  return {
    "vibe-row-added": (params) => params.data?._status === "added",
    "vibe-row-updated": (params) => params.data?._status === "updated",
    "vibe-row-deleted": (params) => params.data?._status === "deleted",
  };
}
