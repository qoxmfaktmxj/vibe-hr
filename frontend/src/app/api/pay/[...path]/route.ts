import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const AUTH_COOKIE_NAME = "vibe_hr_token";

async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!accessToken) {
        return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
    }

    // Await the params object (required in Next.js 15+ for dynamic route handlers)
    const resolvedParams = await params;
    const path = resolvedParams.path.join("/");

    // We are mapping /api/pay/[...path] to backend /api/v1/pay/[...path]
    const targetUrl = new URL(`${API_BASE_URL}/api/v1/pay/${path}`);
    // Forward query params
    request.nextUrl.searchParams.forEach((value, key) => {
        targetUrl.searchParams.append(key, value);
    });

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${accessToken}`);
    const reqContentType = request.headers.get("content-type");
    if (reqContentType) {
        headers.set("Content-Type", reqContentType);
    }

    const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        cache: "no-store",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
        // Clone necessary because request body is a stream and can only be read once
        const bodyText = await request.text();
        if (bodyText) {
            fetchOptions.body = bodyText;
        }
    }

    try {
        const upstreamResponse = await fetch(targetUrl.toString(), fetchOptions);

        let data;
        const resContentType = upstreamResponse.headers.get("content-type");
        if (resContentType && resContentType.includes("application/json")) {
            data = await upstreamResponse.json();
        } else {
            data = await upstreamResponse.text();
        }

        return NextResponse.json(data, { status: upstreamResponse.status });
    } catch (error) {
        console.error("Proxy error:", error);
        return NextResponse.json({ detail: "Failed to fetch from backend API" }, { status: 502 });
    }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
