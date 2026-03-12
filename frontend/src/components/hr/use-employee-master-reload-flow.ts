"use client";

import { useCallback, useState } from "react";
import type { GridApi } from "ag-grid-community";

import type { SearchFilters } from "@/lib/hr/employee-master-helpers";
import type { EmployeeGridRow, PendingReloadAction } from "@/components/hr/employee-master-types";

type UseEmployeeMasterReloadFlowArgs = {
  hasDirtyRows: boolean;
  page: number;
  gridApiRef: React.MutableRefObject<GridApi<EmployeeGridRow> | null>;
  rowsRef: React.MutableRefObject<EmployeeGridRow[]>;
  setRows: React.Dispatch<React.SetStateAction<EmployeeGridRow[]>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setAppliedFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  setSyncedPageKey: React.Dispatch<React.SetStateAction<string | null>>;
  tempIdRef: React.MutableRefObject<number>;
};

export function useEmployeeMasterReloadFlow({
  hasDirtyRows,
  page,
  gridApiRef,
  rowsRef,
  setRows,
  setPage,
  setAppliedFilters,
  setSyncedPageKey,
  tempIdRef,
}: UseEmployeeMasterReloadFlowArgs) {
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingReloadAction, setPendingReloadAction] = useState<PendingReloadAction | null>(null);

  const runReloadAction = useCallback((action: PendingReloadAction, discardDirtyRows: boolean) => {
    gridApiRef.current?.stopEditing();
    gridApiRef.current?.deselectAll();

    if (discardDirtyRows) {
      rowsRef.current = [];
      setRows([]);
      setSyncedPageKey(null);
    }

    if (action.type === "page") {
      setPage(action.page);
      return;
    }

    setAppliedFilters(action.filters);
    setPage(1);
    tempIdRef.current = -1;
  }, [gridApiRef, rowsRef, setAppliedFilters, setPage, setRows, setSyncedPageKey, tempIdRef]);

  const requestReloadAction = useCallback((action: PendingReloadAction) => {
    if (action.type === "page" && action.page === page) return;
    if (hasDirtyRows) {
      setPendingReloadAction(action);
      setDiscardDialogOpen(true);
      return;
    }
    runReloadAction(action, false);
  }, [hasDirtyRows, page, runReloadAction]);

  const handleDiscardDialogOpenChange = useCallback((open: boolean) => {
    setDiscardDialogOpen(open);
    if (!open) setPendingReloadAction(null);
  }, []);

  const handleDiscardAndContinue = useCallback(() => {
    if (!pendingReloadAction) {
      setDiscardDialogOpen(false);
      return;
    }
    runReloadAction(pendingReloadAction, true);
    setPendingReloadAction(null);
    setDiscardDialogOpen(false);
  }, [pendingReloadAction, runReloadAction]);

  return {
    discardDialogOpen,
    requestReloadAction,
    handleDiscardDialogOpenChange,
    handleDiscardAndContinue,
  };
}
