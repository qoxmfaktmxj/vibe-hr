import { AppShell } from "@/components/layout/app-shell";
import { PapAppraisalManager } from "@/components/pap/pap-appraisal-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "pap.appraisals",
} as const;

export default async function PapAppraisalsPage() {
  await requireMenuAccess("/pap/appraisals");

  return (
    <AppShell
      title="Performance Appraisal Master"
      description="Manage performance appraisal cycles and base master records."
    >
      <PapAppraisalManager />
    </AppShell>
  );
}
