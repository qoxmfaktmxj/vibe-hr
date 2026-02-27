import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import type { AuthUser } from "@/types/auth";
import type { MenuNode, MenuTreeResponse } from "@/types/menu";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

export const getAccessToken = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
});

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;
    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
});

export const getMenuTree = cache(async (): Promise<MenuNode[]> => {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/menus/tree`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return [];
    const data = (await response.json()) as MenuTreeResponse;
    return data.menus;
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
