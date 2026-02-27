import { IconCatalogManager } from "@/components/settings/icon-catalog-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsIconsPage() {
  await requireMenuAccess("/settings/icons");

  return <IconCatalogManager />;
}
