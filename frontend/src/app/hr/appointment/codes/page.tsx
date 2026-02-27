import { HrAppointmentCodeManager } from "@/components/hr/hr-appointment-code-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.appointment.codes",
} as const;

export default async function HrAppointmentCodesPage() {
  await requireMenuAccess("/hr/appointment/codes");

  return (
    <AppShell title="발령코드관리" description="발령코드 및 인사 반영 매핑 기준을 관리합니다.">
      <HrAppointmentCodeManager />
    </AppShell>
  );
}

