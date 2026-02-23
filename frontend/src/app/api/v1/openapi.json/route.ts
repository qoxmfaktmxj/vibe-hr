import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const upstream = await fetch(`${API_BASE_URL}/openapi.json`, {
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
