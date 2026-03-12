import "server-only";

import { cache } from "react";

import type { AuthUser } from "@/types/auth";
import type { MenuNode, MenuTreeResponse } from "@/types/menu";
import { fetchBackendJson, getServerAccessToken } from "@/lib/server/backend-client";

export const getAccessToken = getServerAccessToken;

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  try {
    return await fetchBackendJson<AuthUser>("/api/v1/auth/me", {
      next: { revalidate: 60 },
    });
  } catch {
    return null;
  }
});

export const getMenuTree = cache(async (): Promise<MenuNode[]> => {
  try {
    const data = await fetchBackendJson<MenuTreeResponse>("/api/v1/menus/tree", {
      next: { revalidate: 300 },
    });
    return data?.menus ?? [];
  } catch {
    return [];
  }
});

export function hasMenuPath(menus: MenuNode[], path: string): boolean {
  for (const node of menus) {
    if (node.path === path) return true;
    if (node.children.length > 0 && hasMenuPath(node.children, path)) return true;
  }
  return false;
}
