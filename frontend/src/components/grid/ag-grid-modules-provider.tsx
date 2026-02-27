"use client";

import type React from "react";
import { AgGridProvider } from "ag-grid-react";

import { AG_GRID_SHARED_MODULES } from "@/lib/grid/ag-grid-shared-modules";

export function AgGridModulesProvider({ children }: { children: React.ReactNode }) {
  return <AgGridProvider modules={AG_GRID_SHARED_MODULES}>{children}</AgGridProvider>;
}
