import { TraCyberUploadManager } from "@/components/tra/tra-cyber-upload-manager";
import { requireMenuAccess } from "@/lib/guard";

export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.cyber-upload",
} as const;

export default async function TraCyberUploadPage() {
  await requireMenuAccess("/tra/cyber-upload");
  return <TraCyberUploadManager />;
}
