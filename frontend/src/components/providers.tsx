"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { MenuProvider } from "@/components/auth/menu-provider";
import type { AuthUser } from "@/types/auth";
import type { MenuNode } from "@/types/menu";

export function Providers({
  children,
  initialUser,
  initialMenus,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
  initialMenus: MenuNode[];
}) {
  return (
    <AuthProvider initialUser={initialUser}>
      <MenuProvider initialMenus={initialMenus}>{children}</MenuProvider>
    </AuthProvider>
  );
}
