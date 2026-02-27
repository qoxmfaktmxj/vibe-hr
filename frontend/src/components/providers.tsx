"use client";

import { Toaster } from "sonner";
import { AgGridProvider } from "ag-grid-react";

import { AuthProvider } from "@/components/auth/auth-provider";
import { MenuProvider } from "@/components/auth/menu-provider";
import type { AuthUser } from "@/types/auth";
import type { MenuNode } from "@/types/menu";
import { AG_GRID_SHARED_MODULES } from "@/lib/grid/ag-grid-shared-modules";

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
    <AgGridProvider modules={AG_GRID_SHARED_MODULES}>
      <AuthProvider initialUser={initialUser}>
        <MenuProvider initialMenus={initialMenus}>
          {children}
          <Toaster
            position="top-right"
            closeButton
            duration={3000}
            toastOptions={{
              style: { fontFamily: "var(--font-inter), sans-serif" },
              classNames: {
                success:
                  "!bg-[#eef7ff] !text-[#0c6dce] !border-[#0ea5e9]/30",
                error:
                  "!bg-[#fef2f3] !text-[#cc2936] !border-[#cc2936]/30",
                warning:
                  "!bg-[#fdf2f6] !text-[#b95f89] !border-[#b95f89]/30",
              },
            }}
          />
        </MenuProvider>
      </AuthProvider>
    </AgGridProvider>
  );
}
