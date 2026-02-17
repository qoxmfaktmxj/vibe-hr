import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { DashboardSummary } from "@/types/dashboard";
import type { MenuNode, MenuTreeResponse } from "@/types/menu";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const fallbackSummary: DashboardSummary = {
  total_employees: 1248,
  total_departments: 12,
  attendance_present_today: 1098,
  attendance_late_today: 73,
  attendance_absent_today: 77,
  pending_leave_requests: 16,
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("vibe_hr_token")?.value;

  if (!accessToken) {
    redirect("/login");
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/dashboard/summary`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      redirect("/login");
    }

    if (!response.ok) {
      return fallbackSummary;
    }

    return (await response.json()) as DashboardSummary;
  } catch {
    return fallbackSummary;
  }
}

export async function getMenuTree(): Promise<MenuNode[]> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("vibe_hr_token")?.value;

  if (!accessToken) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/menus/tree`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as MenuTreeResponse;
    return data.menus;
  } catch {
    return [];
  }
}
