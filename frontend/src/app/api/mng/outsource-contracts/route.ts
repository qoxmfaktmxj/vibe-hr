import { proxyGet, proxyPost, proxyPut, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/api/v1/mng/outsource-contracts");
export const POST = proxyPost("/api/v1/mng/outsource-contracts");
export const PUT = proxyPut("/api/v1/mng/outsource-contracts");
export const DELETE = proxyDelete("/api/v1/mng/outsource-contracts");
