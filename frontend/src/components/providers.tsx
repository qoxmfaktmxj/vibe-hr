"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import type { AuthUser } from "@/types/auth";

export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  return <AuthProvider initialUser={initialUser}>{children}</AuthProvider>;
}
