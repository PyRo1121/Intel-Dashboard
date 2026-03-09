import { applyDefaultSecurityHeaders, buildCorsHeaders, DEFAULT_APP_ORIGIN } from "./security-guards.ts";

export function mergeVary(existing: string | null, values: string[]): string {
  const set = new Set<string>();
  if (existing) {
    for (const part of existing.split(",")) {
      const key = part.trim();
      if (key) set.add(key);
    }
  }
  for (const value of values) {
    const key = value.trim();
    if (key) set.add(key);
  }
  return [...set].join(", ");
}

export function corsHeaders(origin?: string | null): Record<string, string> {
  return buildCorsHeaders({ origin, fallbackOrigin: DEFAULT_APP_ORIGIN });
}

export function corsJson(
  origin: string | null,
  status: number,
  payload: Record<string, unknown>,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...corsHeaders(origin),
  });
  if (extraHeaders) {
    const extra = new Headers(extraHeaders);
    for (const [key, value] of extra.entries()) {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}

export function privateApiHeaders(origin: string | null, existingVary: string | null = null): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    ...corsHeaders(origin),
  });
  headers.set(
    "Vary",
    mergeVary(existingVary, ["Origin", "Cookie", "Authorization"]),
  );
  return headers;
}

export function privateApiJson(
  origin: string | null,
  status: number,
  payload: Record<string, unknown>,
  existingVary: string | null = null,
  extraHeaders?: HeadersInit,
): Response {
  const headers = privateApiHeaders(origin, existingVary);
  if (extraHeaders) {
    const extra = new Headers(extraHeaders);
    for (const [key, value] of extra.entries()) {
      headers.set(key, value);
    }
  }
  const response = new Response(JSON.stringify(payload), {
    status,
    headers,
  });
  applyDefaultSecurityHeaders(response.headers);
  return response;
}

export function privateApiMethodNotAllowed(
  origin: string | null,
  allow: string,
  payload: Record<string, unknown> = { error: "Method Not Allowed" },
): Response {
  return privateApiJson(origin, 405, payload, null, { Allow: allow });
}
