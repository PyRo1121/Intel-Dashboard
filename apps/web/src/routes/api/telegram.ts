import type { APIEvent } from "@solidjs/start/server";
import { proxyAuthenticatedApi } from "../../lib/server-api-proxy";

export async function GET(event: APIEvent) {
  return proxyAuthenticatedApi(event, "/api/telegram");
}
