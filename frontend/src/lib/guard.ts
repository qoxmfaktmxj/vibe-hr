import "server-only";

import { redirect } from "next/navigation";

import { getAccessToken, getMenuTree, hasMenuPath } from "@/lib/server/session";

/**
 * 서버 컴포넌트에서 현재 사용자가 특정 경로에 접근 가능한지 확인한다.
 * 접근 불가 시 /unauthorized 로 리다이렉트한다.
 */
export async function requireMenuAccess(path: string): Promise<void> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    redirect("/login");
  }

  const menus = await getMenuTree();

  if (menus.length === 0) {
    redirect("/unauthorized");
  }

  if (!hasMenuPath(menus, path)) {
    redirect("/unauthorized");
  }
}
