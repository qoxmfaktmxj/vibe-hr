import { HrAppointmentCodeManager } from "@/components/hr/hr-appointment-code-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "hr.appointment.codes",
} as const;

void GRID_SCREEN;

export default async function HrAppointmentCodesPage() {
  await requireMenuAccess("/hr/appointment/codes");

  return <HrAppointmentCodeManager />;
}
