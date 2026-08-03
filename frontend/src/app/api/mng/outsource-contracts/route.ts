import { proxyGet, proxyPost, proxyPut, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/mng/outsource-contracts");
export const POST = proxyPost("/mng/outsource-contracts");
export const PUT = proxyPut("/mng/outsource-contracts");
export const DELETE = proxyDelete("/mng/outsource-contracts");
