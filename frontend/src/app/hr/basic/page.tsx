import { HrBasicWorkspace } from "@/components/hr/hr-basic-workspace";
import { requireMenuAccess } from "@/lib/guard";

export default async function HrBasicPage() {
  await requireMenuAccess("/hr/basic");

  return (
      <HrBasicWorkspace />
  );
}
