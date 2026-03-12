"use client";

import { useEffect } from "react";

import type { EmployeeMasterViewState } from "@/components/hr/employee-master-types";

let cachedEmployeeMasterViewState: EmployeeMasterViewState | null = null;

export function getCachedEmployeeMasterViewState(): EmployeeMasterViewState | null {
  return cachedEmployeeMasterViewState;
}

type UseEmployeeMasterViewStateCacheArgs = Omit<EmployeeMasterViewState, "tempId"> & {
  tempIdRef: React.MutableRefObject<number>;
};

export function useEmployeeMasterViewStateCache({
  tempIdRef,
  ...viewState
}: UseEmployeeMasterViewStateCacheArgs) {
  useEffect(() => {
    cachedEmployeeMasterViewState = {
      ...viewState,
      tempId: tempIdRef.current,
    };
  }, [tempIdRef, viewState]);
}
