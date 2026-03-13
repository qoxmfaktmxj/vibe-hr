import { AppShell } from "@/components/layout/app-shell";
import { DevRequestManager } from "@/components/mng/dev-request-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.dev-requests",
} as const;

export default async function MngDevRequestsPage() {
  await requireMenuAccess("/mng/dev-requests");

  return (
    <AppShell title="추가 개발 관리" description="추가 개발 요청과 월별 집계를 확인합니다.">
      <DevRequestManager />
    </AppShell>
  );
}
