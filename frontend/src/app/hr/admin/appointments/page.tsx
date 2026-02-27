import { requireMenuAccess } from "@/lib/guard";
import { redirect } from "next/navigation";

export default async function HrAdminAppointmentsRedirectPage() {
  await requireMenuAccess("/hr/appointment/records");
  redirect("/hr/appointment/records");
}
