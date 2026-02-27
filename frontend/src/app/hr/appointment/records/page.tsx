import { HrAppointmentRecordManager } from "@/components/hr/hr-appointment-record-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.appointment.records",
} as const;

export default async function HrAppointmentRecordsPage() {
  await requireMenuAccess("/hr/appointment/records");

  return <HrAppointmentRecordManager />;
}
