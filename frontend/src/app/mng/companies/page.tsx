import { AppShell } from "@/components/layout/app-shell";
import { CompanyManager } from "@/components/mng/company-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.companies",
} as const;

export default async function MngCompaniesPage() {
  await requireMenuAccess("/mng/companies");

  return (
    <AppShell title="고객사관리" description="고객사 정보를 등록, 수정, 삭제합니다.">
      <CompanyManager />
    </AppShell>
  );
}
