import { HrRecruitFinalistManager } from "@/components/hr/hr-recruit-finalist-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.recruit.finalists",
} as const;

export default async function HrRecruitFinalistsPage() {
  await requireMenuAccess("/hr/recruit/finalists");

  return <HrRecruitFinalistManager />;
}

