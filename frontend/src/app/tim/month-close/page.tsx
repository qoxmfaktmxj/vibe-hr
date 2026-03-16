import { TimMonthCloseManager } from "@/components/tim/tim-month-close-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "custom",
  profile: "standard-v2",
  registryKey: "tim.month-close",
} as const;

export default async function TimMonthClosePage() {
  await requireMenuAccess("/tim/month-close");

  return <TimMonthCloseManager />;
}
