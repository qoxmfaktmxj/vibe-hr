import { TraCourseEventsManager } from "@/components/tra/tra-course-events-manager";
import { requireMenuAccess } from "@/lib/guard";

const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v2",
  registryKey: "tra.course-events",
} as const;

void GRID_SCREEN;

export default async function TraCourseEventsPage() {
  await requireMenuAccess("/tra/course-events");
  return <TraCourseEventsManager />;
}
