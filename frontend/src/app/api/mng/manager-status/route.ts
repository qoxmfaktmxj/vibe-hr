import { proxyGet, proxyPost, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/mng/manager-status");
export const POST = proxyPost("/mng/manager-status");
export const DELETE = proxyDelete("/mng/manager-status");
