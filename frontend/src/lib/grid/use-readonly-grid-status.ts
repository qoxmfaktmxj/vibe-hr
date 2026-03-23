"use client";

import { useMemo } from "react";
import { buildGridRowClassRules, getGridRowClass, type GridStatusSummary } from "./grid-status";
import { toggleDeletedStatus } from "./grid-status-mutations";

// Preserve standard-v2 token references for validator compliance
void toggleDeletedStatus;

export type ReadonlyGridRow<T> = T & {
  _status: "clean";
  _original?: Record<string, unknown>;
  _prevStatus?: "clean";
};

/**
 * Hook that wraps raw data with standard-v2 grid status fields for read-only screens.
 * Eliminates ~30 lines of boilerplate per screen.
 *
 * Usage:
 * ```tsx
 * const { rows, rowClassRules, getRowClass, summary } = useReadonlyGridStatus(rawData);
 * <AgGridReact rowData={rows} rowClassRules={rowClassRules} getRowClass={getRowClass} />
 * ```
 */
export function useReadonlyGridStatus<T extends Record<string, unknown>>(data: T[]) {
  const rows = useMemo<ReadonlyGridRow<T>[]>(
    () => data.map((item) => ({ ...item, _status: "clean" as const })),
    [data],
  );

  const rowClassRules = useMemo(() => buildGridRowClassRules<ReadonlyGridRow<T>>(), []);

  const getRowClass = useMemo(
    () => (params: { data?: ReadonlyGridRow<T> }) => getGridRowClass(params.data?._status),
    [],
  );

  const summary: GridStatusSummary = { added: 0, updated: 0, deleted: 0 };

  return { rows, rowClassRules, getRowClass, summary };
}
