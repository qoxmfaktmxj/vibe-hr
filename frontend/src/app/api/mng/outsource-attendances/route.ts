import { proxyGet, proxyPost, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/mng/outsource-attendances/summary");
export const POST = proxyPost("/mng/outsource-attendances");
export const DELETE = proxyDelete("/mng/outsource-attendances");
