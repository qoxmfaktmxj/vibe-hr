import { CommonCodeManager } from "@/components/settings/common-code-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "settings.common-codes",
} as const;

void GRID_SCREEN;

export default async function SettingsCommonCodesPage() {
  await requireMenuAccess("/settings/common-codes");

  return (
      <CommonCodeManager />
  );
}
