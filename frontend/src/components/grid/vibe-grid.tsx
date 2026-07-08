"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { fetcher } from "@/lib/fetcher";

/**
 * VibeGrid — shared AG Grid screen wrapper (Step 1/2 of docs/VIBE_GRID_ROADMAP.md).
 *
 * v1 scope: `variant="readonly"` only. It assembles the existing shared grid
 * modules (ManagerPageShell/ManagerSearchSection/ManagerGridSection via
 * ReadonlyGridManager, GridToolbarActions, GridPaginationControls,
 * GridChangeSummaryBadges) with:
 *   - paginated fetch (page/limit/total_count contract) via SWR
 *   - fixed readonly toolbar (query, download) matching the registry contract
 *     enforced by scripts/validate-grid-screens.mjs (readonly toolbar is
 *     always a subset of ["query", "download"])
 *   - generic xlsx download built from the provided column defs
 *
 * `crud` | `approval` | `workflow` variants are not implemented yet — the
 * props are typed so call sites can be written against the target API ahead
 * of the migration wave that implements them (see VIBE_GRID_ROADMAP.md Wave
 * 2-4), but constructing VibeGrid with those variants throws.
 *
 * Registry note: `registryKey` is NOT resolved against
 * config/grid-screens.json at runtime in v1. That file lives outside the
 * Next.js project root, so importing it from client code would require
 * `next.config.ts` (`experimental.externalDir`) changes that are out of
 * scope for this change. Instead, the readonly toolbar (query + download)
 * is derived directly from `variant`, matching the fixed contract that
 * scripts/validate-grid-screens.mjs already enforces for readonly screens
 * (toolbar subset of ["query", "download"]). `registryKey` is kept as a
 * prop for identification/documentation only; a v2 codegen step may wire it
 * up to the registry for real.
 */

export type VibeGridVariant = "crud" | "readonly" | "approval" | "workflow";

type VibeGridRowBase = { id: number | string };

export type VibeGridListResponse<Row> = {
  items: Row[];
  total_count: number;
  page: number;
  limit: number;
};

export type VibeGridProps<Row extends VibeGridRowBase> = {
  /** Key into config/grid-screens.json, e.g. "tim.attendance-status". */
  registryKey: string;
  title: string;
  description?: string;
  variant: VibeGridVariant;
  columns: ColDef<Row & ReadonlyGridRow>[];
  searchFields?: ReactNode;
  fetchUrl: string;
  defaultColDef?: ColDef<Row & ReadonlyGridRow>;
  pageSize?: number;
  emptyText?: string;
  queryLabel?: string;
  gridHeight?: number;
  /** Base file name (without extension) used for the xlsx download. */
  downloadFileName?: string;
  /**
   * Called just before the internal query/re-fetch runs.
   * Use this to apply staged filter state before VibeGrid reads `fetchUrl`.
   * Example: set appliedFilters state so fetchUrl reflects the latest values.
   */
  onQueryStart?: () => void;
};

function toXlsxSheetName(name: string): string {
  // Excel sheet names cannot exceed 31 chars or contain []:*?/\
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet1";
}

async function downloadRowsAsXlsx<Row extends VibeGridRowBase>(
  columns: ColDef<Row & ReadonlyGridRow>[],
  rows: Array<Row & ReadonlyGridRow>,
  title: string,
  fileName: string,
) {
  const visibleColumns = columns.filter((col) => col.field || col.valueGetter);
  const headers = visibleColumns.map((col) => col.headerName ?? String(col.field ?? ""));
  const data = rows.map((row) =>
    visibleColumns.map((col) => {
      const field = col.field as keyof (Row & ReadonlyGridRow) | undefined;
      const rawValue = field ? row[field] : undefined;
      if (typeof col.valueFormatter === "function") {
        // Synthetic params for export: only `value`/`data` are used by
        // formatters in this codebase (e.g. check_in_at/check_out_at in
        // attendance-status-manager). Cast through unknown to avoid
        // constructing the full ag-grid BaseColDefOptionalDataParams shape.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatted = (col.valueFormatter as (p: any) => string)({
          value: rawValue,
          data: row,
        });
        return formatted ?? "";
      }
      return rawValue ?? "";
    }),
  );

  const { utils, writeFileXLSX } = await import("xlsx");
  const sheet = utils.aoa_to_sheet([headers, ...data]);
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, toXlsxSheetName(title));
  writeFileXLSX(book, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function VibeGridReadonly<Row extends VibeGridRowBase>({
  title,
  columns,
  searchFields,
  fetchUrl,
  defaultColDef,
  pageSize = 50,
  emptyText = "데이터가 없습니다.",
  queryLabel = "조회",
  gridHeight,
  downloadFileName,
  onQueryStart,
}: VibeGridProps<Row>) {
  const [page, setPage] = useState(1);
  const [appliedUrl, setAppliedUrl] = useState(fetchUrl);

  const query = useMemo(() => {
    const separator = appliedUrl.includes("?") ? "&" : "?";
    return `${appliedUrl}${separator}page=${page}&limit=${pageSize}`;
  }, [appliedUrl, page, pageSize]);

  const { data, isLoading, mutate } = useSWR<VibeGridListResponse<Row>>(query, fetcher, {
    revalidateOnFocus: false,
  });

  const rowData = useMemo(() => createReadonlyGridRows(data?.items ?? []), [data?.items]);

  const columnDefs = useMemo<ColDef<Row & ReadonlyGridRow>[]>(
    () => columns.map((col) => ({ ...defaultColDef, ...col })),
    [columns, defaultColDef],
  );

  return (
    <ReadonlyGridManager<Row & ReadonlyGridRow>
      title={title}
      searchFields={searchFields}
      rowData={rowData}
      columnDefs={columnDefs}
      totalCount={data?.total_count ?? 0}
      page={data?.page ?? page}
      pageSize={data?.limit ?? pageSize}
      onPageChange={setPage}
      onQuery={() => {
        onQueryStart?.();
        setPage(1);
        setAppliedUrl(fetchUrl);
        void mutate();
      }}
      onDownload={() =>
        void downloadRowsAsXlsx(columnDefs, rowData, title, downloadFileName ?? title)
      }
      queryDisabled={isLoading}
      queryLabel={queryLabel}
      gridHeight={gridHeight}
      emptyText={emptyText}
      loading={isLoading}
    />
  );
}

export function VibeGrid<Row extends VibeGridRowBase>(props: VibeGridProps<Row>) {
  if (props.variant !== "readonly") {
    // crud/approval/workflow variants are not implemented in VibeGrid v1.
    // See docs/VIBE_GRID_ROADMAP.md Wave 2-4 for the planned rollout.
    throw new Error(
      `VibeGrid variant "${props.variant}" is not implemented yet (v1 supports "readonly" only).`,
    );
  }

  return <VibeGridReadonly {...props} />;
}
