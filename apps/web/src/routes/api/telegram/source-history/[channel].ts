import type { APIEvent } from "@solidjs/start/server";
import { proxyAuthenticatedApi } from "../../../../lib/server-api-proxy";

export async function GET(event: APIEvent): Promise<Response> {
  const channel = encodeURIComponent(event.params.channel ?? "");
  return proxyAuthenticatedApi(event, `/api/telegram/source-history/${channel}`);
}
