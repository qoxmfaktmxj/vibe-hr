import { proxyDelete, proxyGet, proxyPost, proxyPut } from "@/lib/mng-proxy";

export const GET = proxyGet("/api/v1/mng/companies");
export const POST = proxyPost("/api/v1/mng/companies");
export const PUT = proxyPut("/api/v1/mng/companies");
export const DELETE = proxyDelete("/api/v1/mng/companies");
