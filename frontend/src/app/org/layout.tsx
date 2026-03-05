import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function OrgLayout({ children }: { children: ReactNode }) {
  return <AppShell title="VIBE-HR">{children}</AppShell>;
}
