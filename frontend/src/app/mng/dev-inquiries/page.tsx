import { AppShell } from "@/components/layout/app-shell";
import { DevInquiryManager } from "@/components/mng/dev-inquiry-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function MngDevInquiriesPage() {
  await requireMenuAccess("/mng/dev-inquiries");

  return (
    <AppShell title="문의관리" description="추가개발 문의를 관리합니다.">
      <DevInquiryManager />
    </AppShell>
  );
}

