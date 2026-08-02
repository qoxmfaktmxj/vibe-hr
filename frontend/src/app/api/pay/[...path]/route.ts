import { NextRequest, NextResponse } from "next/server";
import { forwardBackendResponse } from "@/app/api/_lib/forward-backend-response";
import { InvalidCatchallPathError, safeCatchallUrl } from "@/app/api/_lib/safe-catchall-url";

const AUTH_COOKIE_NAME = "vibe_hr_token";

async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const resolvedParams = await params;
  let targetUrl: URL;
  try {
    targetUrl = safeCatchallUrl("pay", resolvedParams.path, request.nextUrl.search);
  } catch (error) {
    if (error instanceof InvalidCatchallPathError) {
      return NextResponse.json({ detail: "Invalid API path." }, { status: 400 });
    }
    throw error;
  }

  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  const requestContentType = request.headers.get("content-type");
  if (requestContentType) headers.set("Content-Type", requestContentType);
  for (const name of ["range", "if-range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const options: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const bodyText = await request.text();
    if (bodyText) options.body = bodyText;
  }

  try {
    return forwardBackendResponse(await fetch(targetUrl.toString(), options));
  } catch (error) {
    console.error("PAY proxy error:", error);
    return NextResponse.json({ detail: "Failed to fetch from backend API" }, { status: 502 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
