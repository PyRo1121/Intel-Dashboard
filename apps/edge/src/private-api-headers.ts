import { applyDefaultSecurityHeaders, buildCorsHeaders, DEFAULT_APP_ORIGIN } from "./security-guards.ts";
import { jsonResponse } from "./json-response.ts";

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

export function applyCorsHeaders(headers: Headers, origin?: string | null): Headers {
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    headers.set(key, value);
  }
  return headers;
}

export function corsJson(
  origin: string | null,
  status: number,
  payload: Record<string, unknown>,
  extraHeaders?: HeadersInit,
): Response {
  const headers = applyCorsHeaders(new Headers(), origin);
  if (extraHeaders) {
    const extra = new Headers(extraHeaders);
    for (const [key, value] of extra.entries()) {
      headers.set(key, value);
    }
  }
  return jsonResponse(payload, {
    status,
    headers,
  });
}

export function privateApiHeaders(origin: string | null, existingVary: string | null = null): Headers {
  const headers = new Headers({
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
  const response = jsonResponse(payload, {
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
