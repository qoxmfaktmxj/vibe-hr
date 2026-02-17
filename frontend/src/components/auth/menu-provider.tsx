"use client";

import { createContext, useContext, useMemo } from "react";

import type { MenuNode } from "@/types/menu";

type MenuContextValue = {
  menus: MenuNode[];
  /** 특정 경로에 대한 접근 권한이 있는지 확인 */
  hasAccess: (path: string) => boolean;
  /** 특정 메뉴 코드에 대한 접근 권한이 있는지 확인 */
  hasMenuCode: (code: string) => boolean;
};

const MenuContext = createContext<MenuContextValue | null>(null);

/** 트리에서 모든 경로/코드를 플랫하게 수집 */
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
  const value = useMemo<MenuContextValue>(() => {
    const pathSet = collectPaths(initialMenus);
    const codeSet = collectCodes(initialMenus);

    return {
      menus: initialMenus,
      hasAccess: (path: string) => pathSet.has(path),
      hasMenuCode: (code: string) => codeSet.has(code),
    };
  }, [initialMenus]);

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("useMenu must be used within a MenuProvider.");
  }
  return context;
}
