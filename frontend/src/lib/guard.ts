import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { MenuTreeResponse } from "@/types/menu";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

/**
 * 서버 컴포넌트에서 현재 사용자가 특정 경로에 접근 가능한지 확인한다.
 * 접근 불가 시 /unauthorized 로 리다이렉트한다.
 *
 * 사용 예:
 *   // app/hr/employee/page.tsx
 *   export default async function Page() {
 *     await requireMenuAccess("/hr/employee");
 *     return <div>사원관리 페이지</div>;
 *   }
 */
export async function requireMenuAccess(path: string): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!accessToken) {
    redirect("/login");
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/menus/tree`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      redirect("/login");
    }

    if (!response.ok) {
      redirect("/unauthorized");
    }

    const data = (await response.json()) as MenuTreeResponse;

    // 트리에서 해당 경로가 포함되어 있는지 확인
    function hasPath(nodes: MenuTreeResponse["menus"]): boolean {
      for (const node of nodes) {
        if (node.path === path) return true;
        if (node.children.length > 0 && hasPath(node.children)) return true;
      }
      return false;
    }

    if (!hasPath(data.menus)) {
      redirect("/unauthorized");
    }
  } catch (error) {
    // redirect()는 에러를 throw하므로, 그것은 다시 throw 해야 함
    throw error;
  }
}
