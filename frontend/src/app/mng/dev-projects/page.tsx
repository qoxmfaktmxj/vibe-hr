import { AppShell } from "@/components/layout/app-shell";
import { DevProjectManager } from "@/components/mng/dev-project-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.dev-projects",
} as const;

void GRID_SCREEN;

export default async function MngDevProjectsPage() {
  await requireMenuAccess("/mng/dev-projects");

  return (
    <AppShell title="프로젝트 관리" description="추가 개발 프로젝트를 관리합니다.">
      <DevProjectManager />
    </AppShell>
  );
}
