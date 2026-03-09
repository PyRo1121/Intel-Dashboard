import type { APIEvent } from "@solidjs/start/server";
import { proxyAuthenticatedApi } from "../../../../lib/server-api-proxy";

export async function POST(event: APIEvent): Promise<Response> {
  return proxyAuthenticatedApi(event, "/api/subscriber/my-alerts/read-all");
}

