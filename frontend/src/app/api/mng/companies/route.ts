import { proxyDelete, proxyGet, proxyPost, proxyPut } from "@/lib/mng-proxy";

export const GET = proxyGet("/mng/companies");
export const POST = proxyPost("/mng/companies");
export const PUT = proxyPut("/mng/companies");
export const DELETE = proxyDelete("/mng/companies");
