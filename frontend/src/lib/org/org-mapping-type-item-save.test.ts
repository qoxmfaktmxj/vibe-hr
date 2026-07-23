import { expect, it } from "vitest";

import {
  applySuccessfulOrgMappingTypeItemSave,
  collectPendingOrgMappingTypeItemRows,
  isOrgMappingTypeItemSaveAllowed,
  type OrgMappingTypeItemSaveRow,
} from "@/lib/org/org-mapping-type-item-save";

function createRow(
  id: number,
  status: OrgMappingTypeItemSaveRow["_status"],
  overrides: Partial<OrgMappingTypeItemSaveRow> = {},
): OrgMappingTypeItemSaveRow {
  return {
    id,
    type_code: "COST",
    item_code: `ITEM-${id}`,
    name: `항목 ${id}`,
    effective_from: "2026-01-01",
    effective_to: null,
    erp_employee_code: null,
    cost_center_type: null,
    remark: null,
    sort_order: id,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    _status: status,
    ...overrides,
  };
}

it("keeps already successful save rows out of the next retry pass", () => {
  const deletedRow = createRow(3, "deleted");
  const addedRow = createRow(-1, "added", { item_code: "NEW-1", name: "신규 항목" });
  const updatedRow = createRow(2, "updated", { name: "수정 대상" });

  const initialRows = [deletedRow, addedRow, updatedRow];
  const initialPending = collectPendingOrgMappingTypeItemRows(initialRows);

  expect(initialPending.deleted.map((row) => row.id)).toEqual([3]);
  expect(initialPending.added.map((row) => row.id)).toEqual([-1]);
  expect(initialPending.updated.map((row) => row.id)).toEqual([2]);

  const afterDelete = applySuccessfulOrgMappingTypeItemSave(
    initialRows,
    { type: "delete", rowId: 3 },
    (row) => ({ id: row.id, item_code: row.item_code }),
  );
  const afterInsert = applySuccessfulOrgMappingTypeItemSave(
    afterDelete,
    {
      type: "upsert",
      previousId: -1,
      row: {
        ...addedRow,
        id: 101,
        item_code: "NEW-1",
        name: "신규 항목",
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    },
    (row) => ({ id: row.id, item_code: row.item_code }),
  );
  const afterUpdate = applySuccessfulOrgMappingTypeItemSave(
    afterInsert,
    {
      type: "upsert",
      previousId: 2,
      row: {
        ...updatedRow,
        name: "수정 완료",
        updated_at: "2026-01-03T00:00:00.000Z",
      },
    },
    (row) => ({ id: row.id, item_code: row.item_code }),
  );

  expect(collectPendingOrgMappingTypeItemRows(afterDelete).deleted).toHaveLength(0);
  expect(collectPendingOrgMappingTypeItemRows(afterInsert).added).toHaveLength(0);
  expect(collectPendingOrgMappingTypeItemRows(afterInsert).updated.map((row) => row.id)).toEqual([2]);
  expect(collectPendingOrgMappingTypeItemRows(afterUpdate)).toEqual({
    deleted: [],
    added: [],
    updated: [],
  });
  expect(afterUpdate.some((row) => row.id === 3)).toBe(false);
  expect(afterUpdate.find((row) => row.id === 101)?._status).toBe("clean");
  expect(afterUpdate.find((row) => row.id === 2)?._status).toBe("clean");
});

it("blocks save access while menu actions are still loading", () => {
  expect(isOrgMappingTypeItemSaveAllowed(true, true)).toBe(false);
  expect(isOrgMappingTypeItemSaveAllowed(false, true)).toBe(true);
  expect(isOrgMappingTypeItemSaveAllowed(false, false)).toBe(false);
});
