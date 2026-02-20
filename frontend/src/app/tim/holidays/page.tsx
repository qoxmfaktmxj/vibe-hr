import { AppShell } from "@/components/layout/app-shell";
import { HolidayManager } from "@/components/tim/holiday-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function TimHolidaysPage() {
  await requireMenuAccess("/tim/holidays");

  return (
    <AppShell title="휴일관리" description="연도별 휴일 기준 관리">
      <HolidayManager />
    </AppShell>
  );
}
