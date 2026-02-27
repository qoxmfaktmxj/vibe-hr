import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function TraLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Vibe-HR">{children}</AppShell>;
}
