import { proxyGet, proxyPost, proxyPut, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/mng/dev-requests");
export const POST = proxyPost("/mng/dev-requests");
export const PUT = proxyPut("/mng/dev-requests");
export const DELETE = proxyDelete("/mng/dev-requests");
