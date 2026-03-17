import { TimMonthCloseManager } from "@/components/tim/tim-month-close-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "tim.month-closing",
} as const;

export default async function TimMonthClosingPage() {
  await requireMenuAccess("/tim/month-closing");

  return <TimMonthCloseManager />;
}
