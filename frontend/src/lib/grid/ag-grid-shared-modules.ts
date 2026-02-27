import { AllCommunityModule, ValidationModule, type Module } from "ag-grid-community";

const isDev = process.env.NODE_ENV !== "production";

export const AG_GRID_SHARED_MODULES: Module[] = [
  AllCommunityModule,
  ...(isDev ? [ValidationModule] : []),
];
