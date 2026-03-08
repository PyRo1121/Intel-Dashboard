import type { APIEvent } from "@solidjs/start/server";
import { SITE_ORIGIN } from "../../shared/site-config.ts";

const DEFAULT_EDGE_ORIGIN = SITE_ORIGIN;

function trim(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrigin(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function normalizeTrustedProxyOrigin(raw: string): string {
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("INTEL_EDGE_PROXY_ORIGIN must use http or https");
  }
  if (!isLoopbackHost(parsed.hostname) && parsed.origin !== SITE_ORIGIN) {
    throw new Error("INTEL_EDGE_PROXY_ORIGIN must target the canonical edge origin or a loopback dev host");
  }
  parsed.username = "";
  parsed.password = "";
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return normalizeOrigin(parsed.toString());
}

function resolveProxyOrigin(event: APIEvent): string {
  const explicit = trim(process.env.INTEL_EDGE_PROXY_ORIGIN);
  if (explicit) {
    return normalizeTrustedProxyOrigin(explicit);
  }

  const requestUrl = new URL(event.request.url);
  const requestHost = requestUrl.host.toLowerCase();
  if (requestHost === "intel.pyro1121.com") {
    throw new Error("INTEL_EDGE_PROXY_ORIGIN is required when local API routes run on the production host.");
  }

  return DEFAULT_EDGE_ORIGIN;
}

function buildProxyHeaders(event: APIEvent, targetUrl: URL): Headers {
  const headers = new Headers();
  const cookie = event.request.headers.get("cookie");
  const authorization = event.request.headers.get("authorization");
  const accept = event.request.headers.get("accept");
  const contentType = event.request.headers.get("content-type");
  const userAgent = event.request.headers.get("user-agent");

  if (cookie) headers.set("cookie", cookie);
  if (authorization) headers.set("authorization", authorization);
  if (accept) headers.set("accept", accept);
  if (contentType) headers.set("content-type", contentType);
  if (userAgent) headers.set("user-agent", userAgent);

  headers.set("x-forwarded-host", new URL(event.request.url).host);
  headers.set("x-forwarded-proto", new URL(event.request.url).protocol.replace(":", ""));
  headers.set("x-proxy-origin", targetUrl.origin);

  return headers;
}

function buildPrivateApiError(status: number, error: string, detail?: string): Response {
  return new Response(
    JSON.stringify(detail ? { error, detail } : { error }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "CDN-Cache-Control": "no-store",
        Vary: "Origin, Cookie, Authorization",
      },
    },
  );
}

function applyPrivateApiDefaults(response: Response): Response {
  const proxied = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  proxied.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  proxied.headers.set("CDN-Cache-Control", "no-store");
  proxied.headers.set("Vary", "Origin, Cookie, Authorization");
  return proxied;
}

export async function proxyAuthenticatedApi(event: APIEvent, path: string): Promise<Response> {
  let origin: string;
  try {
    origin = resolveProxyOrigin(event);
  } catch (error) {
    return buildPrivateApiError(
      503,
      "API proxy misconfigured",
      error instanceof Error ? error.message : "unknown_error",
    );
  }

  const targetUrl = new URL(path, `${origin}/`);
  const requestUrl = new URL(event.request.url);
  targetUrl.search = requestUrl.search;

  const init: RequestInit = {
    method: event.request.method,
    headers: buildProxyHeaders(event, targetUrl),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  };

  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    init.body = await event.request.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (error) {
    return buildPrivateApiError(
      502,
      "Upstream API unavailable",
      error instanceof Error ? error.message : "unknown_error",
    );
  }

  return applyPrivateApiDefaults(upstream);
}
