import { AppShell } from "@/components/layout/app-shell";
import { WelBenefitRequestOverview } from "@/components/wel/wel-benefit-request-overview";
import { requireMenuAccess } from "@/lib/guard";
import { fetchBackendJson, getServerAccessToken } from "@/lib/server/backend-client";
import type { WelBenefitRequestListResponse } from "@/types/welfare";

export const dynamic = "force-dynamic";

export default async function WelRequestsPage() {
  await requireMenuAccess("/wel/requests");

  const accessToken = await getServerAccessToken();
  const response = await fetchBackendJson<WelBenefitRequestListResponse>("/api/v1/wel/requests", {
    accessToken,
    cache: "no-store",
  });

  return (
    <AppShell
      title="복리후생 신청현황"
      description="복리후생 요청의 신청, 승인, 반려, 급여반영 상태를 샘플 데이터로 확인합니다."
    >
      <WelBenefitRequestOverview items={response?.items ?? []} />
    </AppShell>
  );
}
