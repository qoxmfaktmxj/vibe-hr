import "server-only";

import { redirect } from "next/navigation";

import type { DashboardSummary } from "@/types/dashboard";
import { fetchBackendJson, getServerAccessToken } from "@/lib/server/backend-client";

export type DashboardSummaryResult =
  | { ok: true; summary: DashboardSummary }
  | { ok: false; reason: "unauthenticated" | "unavailable" };

export async function getDashboardSummary(): Promise<DashboardSummaryResult> {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    redirect("/login");
  }

  try {
    const summary = await fetchBackendJson<DashboardSummary>("/api/v1/dashboard/summary", {
      cache: "no-store",
      accessToken,
    });

    if (!summary) {
      return { ok: false, reason: "unavailable" };
    }

    return { ok: true, summary };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
