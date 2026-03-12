import type { ReactNode } from "react";

import { ProtectedSessionLayout } from "@/components/layout/protected-session-layout";

export default function WelLayout({ children }: { children: ReactNode }) {
  return <ProtectedSessionLayout>{children}</ProtectedSessionLayout>;
}
