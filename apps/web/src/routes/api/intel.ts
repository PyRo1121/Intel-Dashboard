import { createProxyGetHandler } from "../../lib/server-api-proxy";

export const GET = createProxyGetHandler("/api/intel");
