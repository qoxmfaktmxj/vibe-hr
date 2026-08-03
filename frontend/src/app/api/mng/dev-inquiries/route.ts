import { proxyGet, proxyPost, proxyPut, proxyDelete } from "@/lib/mng-proxy";
export const GET = proxyGet("/mng/dev-inquiries");
export const POST = proxyPost("/mng/dev-inquiries");
export const PUT = proxyPut("/mng/dev-inquiries");
export const DELETE = proxyDelete("/mng/dev-inquiries");
