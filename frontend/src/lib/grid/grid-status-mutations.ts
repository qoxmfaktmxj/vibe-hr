import { resolveRestoredStatus, type GridRowStatus } from "@/lib/hr/grid-change-tracker";

type StatusTrackedRow = {
  id: number;
  _status: GridRowStatus;
  _prevStatus?: GridRowStatus;
};

type StatusMutationOptions<T extends StatusTrackedRow> = {
  shouldBeClean: (candidate: T) => boolean;
  removeAddedRow?: boolean;
};

type ClearSavedStatusOptions<T extends StatusTrackedRow> = {
  removeDeleted?: boolean;
  buildOriginal?: (row: T) => Record<string, unknown> | undefined;
};

export function reconcileUpdatedStatus<T extends StatusTrackedRow>(
  row: T,
  options: Pick<StatusMutationOptions<T>, "shouldBeClean">,
): T {
  if (row._status === "added" || row._status === "deleted") {
    return row;
  }
  return {
    ...row,
    _status: options.shouldBeClean(row) ? "clean" : "updated",
  };
}

export function toggleDeletedStatus<T extends StatusTrackedRow>(
  rows: readonly T[],
  rowId: number,
  checked: boolean,
  options: StatusMutationOptions<T>,
): T[] {
  const next: T[] = [];
  for (const row of rows) {
    if (row.id !== rowId) {
      next.push(row);
      continue;
    }

    if (!checked) {
      if (row._status === "deleted") {
        const restored = resolveRestoredStatus(row, (candidate) =>
          options.shouldBeClean(candidate as T),
        );
        next.push({
          ...row,
          _status: restored,
          _prevStatus: undefined,
        });
      } else {
        next.push(row);
      }
      continue;
    }

    if (row._status === "added" && options.removeAddedRow) {
      continue;
    }

    if (row._status !== "deleted") {
      next.push({
        ...row,
        _status: "deleted",
        _prevStatus: row._status,
      });
    } else {
      next.push(row);
    }
  }
  return next;
}

export function clearSavedStatuses<T extends StatusTrackedRow>(
  rows: readonly T[],
  options: ClearSavedStatusOptions<T> = {},
): T[] {
  const next: T[] = [];
  for (const row of rows) {
    if (options.removeDeleted && row._status === "deleted") {
      continue;
    }

    const cleaned = {
      ...row,
      _status: "clean" as const,
      _prevStatus: undefined,
    } as T & { _original?: Record<string, unknown> };

    if (options.buildOriginal) {
      cleaned._original = options.buildOriginal(cleaned);
    }

    next.push(cleaned as T);
  }
  return next;
}
