import { AppShell } from "@/components/layout/app-shell";
import { WelMyRequestsManager } from "@/components/wel/wel-my-requests-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "wel.my-requests",
} as const;

void GRID_SCREEN;

export default async function WelMyRequestsPage() {
  await requireMenuAccess("/wel/my-requests");

  return (
    <AppShell title="내 복리후생 신청" description="복리후생 신청 내역을 조회하고 신규 신청할 수 있습니다.">
      <WelMyRequestsManager />
    </AppShell>
  );
}
