import { AgGridModulesProvider } from "@/components/grid/ag-grid-modules-provider";
import { HriApplicationHub } from "@/components/hri/hri-application-hub";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hri.requests.mine",
} as const;

void GRID_SCREEN;

export default async function HriMyRequestsPage() {
  await requireMenuAccess("/hri/requests/mine");

  return (
    <AppShell
      title="내 신청서"
      description="신청서 작성(임시저장/제출), 회수, 재제출을 처리합니다."
    >
      <AgGridModulesProvider>
        <HriApplicationHub />
      </AgGridModulesProvider>
    </AppShell>
  );
}
