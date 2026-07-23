import type { GridRowStatus } from "@/lib/hr/grid-change-tracker";
import type { OrgMappingTypeItem } from "@/types/organization";

export type OrgMappingTypeItemSaveRow = OrgMappingTypeItem & {
  _status: GridRowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: GridRowStatus;
};

export type OrgMappingTypeItemSaveOutcome =
  | { type: "delete"; rowId: number }
  | { type: "upsert"; previousId: number; row: OrgMappingTypeItem };

export function collectPendingOrgMappingTypeItemRows(rows: readonly OrgMappingTypeItemSaveRow[]) {
  const deleted: OrgMappingTypeItemSaveRow[] = [];
  const added: OrgMappingTypeItemSaveRow[] = [];
  const updated: OrgMappingTypeItemSaveRow[] = [];

  for (const row of rows) {
    if (row._status === "deleted") {
      deleted.push(row);
      continue;
    }
    if (row._status === "added") {
      added.push(row);
      continue;
    }
    if (row._status === "updated") {
      updated.push(row);
    }
  }

  return { deleted, added, updated };
}

export function applySuccessfulOrgMappingTypeItemSave<T extends OrgMappingTypeItemSaveRow>(
  rows: readonly T[],
  outcome: OrgMappingTypeItemSaveOutcome,
  buildOriginal: (row: OrgMappingTypeItem) => Record<string, unknown>,
): T[] {
  if (outcome.type === "delete") {
    return rows.filter((row) => row.id !== outcome.rowId);
  }

  const cleanRow = {
    ...outcome.row,
    _status: "clean" as const,
    _original: buildOriginal(outcome.row),
    _prevStatus: undefined,
  } as T;

  const index = rows.findIndex((row) => row.id === outcome.previousId);
  if (index < 0) {
    return [...rows, cleanRow];
  }

  const next = rows.slice();
  next[index] = cleanRow;
  return next;
}
