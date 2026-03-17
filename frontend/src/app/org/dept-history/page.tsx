import { OrgDeptHistoryManager } from "@/components/org/org-dept-history-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "org.dept-history",
} as const;

export default async function OrgDeptHistoryPage() {
  await requireMenuAccess("/org/dept-history");

  return <OrgDeptHistoryManager />;
}
