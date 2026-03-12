import { AppShell } from "@/components/layout/app-shell";
import { WelBenefitTypeOverview } from "@/components/wel/wel-benefit-type-overview";
import { requireMenuAccess } from "@/lib/guard";
import { fetchBackendJson, getServerAccessToken } from "@/lib/server/backend-client";
import type { WelBenefitTypeListResponse } from "@/types/welfare";

export const dynamic = "force-dynamic";

export default async function WelBenefitTypesPage() {
  await requireMenuAccess("/wel/benefit-types");

  const accessToken = await getServerAccessToken();
  const response = await fetchBackendJson<WelBenefitTypeListResponse>("/api/v1/wel/benefit-types", {
    accessToken,
    cache: "no-store",
  });

  return (
    <AppShell
      title="복리후생 유형관리"
      description="복리후생 코드와 급여 연계 기준을 seed 데이터와 함께 확인합니다."
    >
      <WelBenefitTypeOverview items={response?.items ?? []} />
    </AppShell>
  );
}
