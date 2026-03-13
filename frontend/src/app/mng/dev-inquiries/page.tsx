import { AppShell } from "@/components/layout/app-shell";
import { DevInquiryManager } from "@/components/mng/dev-inquiry-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "mng.dev-inquiries",
} as const;

export default async function MngDevInquiriesPage() {
  await requireMenuAccess("/mng/dev-inquiries");

  return (
    <AppShell title="문의 관리" description="추가 개발 문의를 관리합니다.">
      <DevInquiryManager />
    </AppShell>
  );
}
