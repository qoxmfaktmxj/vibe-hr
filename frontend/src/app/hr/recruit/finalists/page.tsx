import { HrRecruitFinalistManager } from "@/components/hr/hr-recruit-finalist-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.recruit.finalists",
} as const;

export default async function HrRecruitFinalistsPage() {
  await requireMenuAccess("/hr/recruit/finalists");

  return (
    <AppShell title="채용합격자등록" description="채용합격자를 등록하고 사번을 생성합니다.">
      <HrRecruitFinalistManager />
    </AppShell>
  );
}

