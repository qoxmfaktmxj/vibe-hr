import { NextResponse } from "next/server";

import { backendApiBaseUrl } from "@/app/api/_lib/backend-target";

export async function GET() {
  try {
    const upstream = await fetch(`${backendApiBaseUrl()}/openapi.json`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await upstream.json().catch(() => ({ detail: "Failed to load OpenAPI schema." }));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ detail: "OpenAPI schema request failed." }, { status: 502 });
  }
}
