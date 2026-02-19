import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";

let agGridRegistered = false;

export function ensureAgGridRegistered() {
  if (agGridRegistered) return;
  ModuleRegistry.registerModules([AllCommunityModule]);
  agGridRegistered = true;
}
