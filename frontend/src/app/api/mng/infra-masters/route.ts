import { proxyGet, proxyPost, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/mng/infra-masters");
export const POST = proxyPost("/mng/infra-masters");
export const DELETE = proxyDelete("/mng/infra-masters");
