import { HrRecruitFinalistManager } from "@/components/hr/hr-recruit-finalist-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.recruit.finalists",
} as const;

void GRID_SCREEN;

export default async function HrRecruitFinalistsPage() {
  await requireMenuAccess("/hr/recruit/finalists");

  return <HrRecruitFinalistManager />;
}

