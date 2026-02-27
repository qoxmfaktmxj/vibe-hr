import { CommonCodeManager } from "@/components/settings/common-code-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "settings.common-codes",
} as const;

export default async function SettingsCommonCodesPage() {
  await requireMenuAccess("/settings/common-codes");

  return (
      <CommonCodeManager />
  );
}
