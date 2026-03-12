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

  return <WelBenefitTypeOverview items={response?.items ?? []} />;
}
