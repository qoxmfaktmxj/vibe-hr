import { CompanyManager } from "@/components/mng/company-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngCompaniesPage() {
  await requireMenuAccess("/mng/companies");

  return (
    <AppShell title="고객사관리" description="고객사 정보를 등록/수정/삭제합니다.">
      <CompanyManager />
    </AppShell>
  );
}

