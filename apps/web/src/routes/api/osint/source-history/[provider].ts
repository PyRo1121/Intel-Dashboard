import type { APIEvent } from "@solidjs/start/server";
import { proxyAuthenticatedApi } from "../../../../lib/server-api-proxy";

export async function GET(event: APIEvent): Promise<Response> {
  const provider = encodeURIComponent(event.params.provider ?? "");
  return proxyAuthenticatedApi(event, `/api/osint/source-history/${provider}`);
}
