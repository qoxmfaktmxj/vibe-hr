import { TraResourceManager } from "@/components/tra/tra-resource-manager";
import { TRA_SCREEN_CONFIGS } from "@/components/tra/tra-screen-configs";

export function TraApplicationsManager() {
  return <TraResourceManager config={TRA_SCREEN_CONFIGS.applications} />;
}
