import type { DashboardSummary } from "@/types/dashboard";

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
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/dashboard/summary`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return fallbackSummary;
    }
    return (await response.json()) as DashboardSummary;
  } catch {
    return fallbackSummary;
  }
}

