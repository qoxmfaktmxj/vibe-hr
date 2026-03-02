import { SystemSettingsManager } from "@/components/settings/system-settings-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsSystemPage() {
  await requireMenuAccess("/settings/system");

  return <SystemSettingsManager />;
}
