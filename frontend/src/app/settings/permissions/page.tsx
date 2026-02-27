import { PermissionMatrixManager } from "@/components/settings/permission-matrix-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function SettingsPermissionsPage() {
  await requireMenuAccess("/settings/permissions");

  return (
      <PermissionMatrixManager />
  );
}
