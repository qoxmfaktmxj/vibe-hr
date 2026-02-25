import { proxyGet, proxyPost, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/api/v1/mng/outsource-attendances/summary");
export const POST = proxyPost("/api/v1/mng/outsource-attendances");
export const DELETE = proxyDelete("/api/v1/mng/outsource-attendances");
