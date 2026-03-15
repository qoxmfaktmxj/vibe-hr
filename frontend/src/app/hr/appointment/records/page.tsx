import { HrAppointmentRecordManager } from "@/components/hr/hr-appointment-record-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.appointment.records",
} as const;

void GRID_SCREEN;

export default async function HrAppointmentRecordsPage() {
  await requireMenuAccess("/hr/appointment/records");

  return <HrAppointmentRecordManager />;
}
