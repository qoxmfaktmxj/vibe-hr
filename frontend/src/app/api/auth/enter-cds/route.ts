import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function GET() {
  const upstreamResponse = await fetch(`${API_BASE_URL}/api/v1/auth/enter-cds`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await upstreamResponse.json().catch(() => ({ detail: "Request failed" }));
  return NextResponse.json(data, { status: upstreamResponse.status });
}
