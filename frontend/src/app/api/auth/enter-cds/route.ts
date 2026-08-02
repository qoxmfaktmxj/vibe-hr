import { NextResponse } from "next/server";

import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";

export async function GET() {
  const upstreamResponse = await fetch(`${backendApiBaseUrl()}/api/v1/auth/enter-cds`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await upstreamResponse.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}
