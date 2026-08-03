import { proxyGet, proxyPost, proxyPut, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/mng/dev-projects");
export const POST = proxyPost("/mng/dev-projects");
export const PUT = proxyPut("/mng/dev-projects");
export const DELETE = proxyDelete("/mng/dev-projects");
