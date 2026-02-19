"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { MenuNode } from "@/types/menu";

type MenuContextValue = {
  menus: MenuNode[];
  isLoading: boolean;
  refreshMenus: () => Promise<void>;
  hasAccess: (path: string) => boolean;
  hasMenuCode: (code: string) => boolean;
};

const MenuContext = createContext<MenuContextValue | null>(null);

function collectPaths(menus: MenuNode[]): Set<string> {
  const paths = new Set<string>();
  function walk(nodes: MenuNode[]) {
    for (const node of nodes) {
      if (node.path) paths.add(node.path);
      if (node.children.length > 0) walk(node.children);
    }
  }
  walk(menus);
  return paths;
}

function collectCodes(menus: MenuNode[]): Set<string> {
  const codes = new Set<string>();
  function walk(nodes: MenuNode[]) {
    for (const node of nodes) {
      codes.add(node.code);
      if (node.children.length > 0) walk(node.children);
    }
  }
  walk(menus);
  return codes;
}

export function MenuProvider({
  children,
  initialMenus,
}: {
  children: React.ReactNode;
  initialMenus: MenuNode[];
}) {
  const pathname = usePathname();
  const [menus, setMenus] = useState<MenuNode[]>(initialMenus);
  const [isLoading, setIsLoading] = useState(false);

  const refreshMenus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/menus/tree", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        setMenus([]);
        return;
      }

      const data = (await response.json()) as { menus?: MenuNode[] };
      setMenus(data.menus ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMenus(initialMenus);
  }, [initialMenus]);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/unauthorized") {
      return;
    }

    if (menus.length === 0) {
      void refreshMenus();
    }
  }, [menus.length, pathname, refreshMenus]);

  const value = useMemo<MenuContextValue>(() => {
    const pathSet = collectPaths(menus);
    const codeSet = collectCodes(menus);

    return {
      menus,
      isLoading,
      refreshMenus,
      hasAccess: (path: string) => pathSet.has(path),
      hasMenuCode: (code: string) => codeSet.has(code),
    };
  }, [isLoading, menus, refreshMenus]);

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("useMenu must be used within a MenuProvider.");
  }
  return context;
}
