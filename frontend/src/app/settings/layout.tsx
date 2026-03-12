import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ProtectedSessionLayout } from "@/components/layout/protected-session-layout";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedSessionLayout>
      <AppShell title="VIBE-HR">{children}</AppShell>
    </ProtectedSessionLayout>
  );
}
