import { HrAppointmentRecordManager } from "@/components/hr/hr-appointment-record-manager";
import { AppShell } from "@/components/layout/app-shell";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.appointment.records",
} as const;

export default async function HrAppointmentRecordsPage() {
  await requireMenuAccess("/hr/appointment/records");

  return (
    <AppShell title="발령처리관리" description="발령처리 입력, 수정, 삭제와 확정 처리까지 관리합니다.">
      <HrAppointmentRecordManager />
    </AppShell>
  );
}
