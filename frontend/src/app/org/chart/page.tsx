import { requireMenuAccess } from "@/lib/guard";
import { OrgChartManager } from "@/components/org/org-chart-manager";

export default async function Page() {
  await requireMenuAccess("/org/chart");

  return <OrgChartManager />;
}
