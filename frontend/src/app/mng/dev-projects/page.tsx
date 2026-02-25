import { AppShell } from "@/components/layout/app-shell";
import { DevProjectManager } from "@/components/mng/dev-project-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngDevProjectsPage() {
  await requireMenuAccess("/mng/dev-projects");

  return (
    <AppShell title="프로젝트관리" description="추가개발 프로젝트를 관리합니다.">
      <DevProjectManager />
    </AppShell>
  );
}

