export type GridRowStatus = "clean" | "added" | "updated" | "deleted";

export type GridTrackedRow<T extends Record<string, unknown>> = T & {
  _status: GridRowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: GridRowStatus;
};

export function snapshotFields<T extends Record<string, unknown>, K extends keyof T>(
  row: T,
  trackedFields: readonly K[],
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of trackedFields) {
    snapshot[String(field)] = row[field];
  }
  return snapshot;
}

export function isRowRevertedToOriginal<T extends Record<string, unknown>, K extends keyof T>(
  row: GridTrackedRow<T>,
  trackedFields: readonly K[],
): boolean {
  if (!row._original) return false;
  for (const field of trackedFields) {
    const key = String(field);
    if (row[field] !== row._original[key]) {
      return false;
    }
  }
  return true;
}

export function hasRowPatchChanges<T extends Record<string, unknown>>(
  row: T,
  patch: Partial<T>,
): boolean {
  for (const [key, value] of Object.entries(patch)) {
    const rowKey = key as keyof T;
    if (row[rowKey] !== value) {
      return true;
    }
  }
  return false;
}

export function resolveRestoredStatus<T extends Record<string, unknown>>(
  row: GridTrackedRow<T>,
  shouldBeClean: (candidate: GridTrackedRow<T>) => boolean,
): GridRowStatus {
  const restored = row._prevStatus ?? "clean";
  if (restored === "updated") {
    const candidate = { ...row, _status: "updated" as const };
    if (shouldBeClean(candidate)) {
      return "clean";
    }
  }
  return restored;
}
